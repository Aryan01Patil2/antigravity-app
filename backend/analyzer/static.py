"""
FixMyCode Static Analysis Engine
Computes all structural metrics from source code using AST (Python) or regex fallback.
"""
import ast
import re
import math
from typing import Any
from difflib import SequenceMatcher

try:
    from radon.complexity import cc_visit
    from radon.metrics import h_visit
    RADON_AVAILABLE = True
except ImportError:
    RADON_AVAILABLE = False


# ─── Language Detection ────────────────────────────────────────────────────────

LANG_PATTERNS = {
    "python": [r"def\s+\w+\s*\(", r"import\s+\w+", r"print\s*\(", r":\s*$"],
    "javascript": [r"function\s+\w+", r"const\s+\w+\s*=", r"let\s+\w+", r"=>\s*{", r"require\("],
    "typescript": [r":\s*(string|number|boolean|void|any)\b", r"interface\s+\w+", r"type\s+\w+\s*="],
    "java": [r"public\s+class\s+\w+", r"System\.out\.print", r"import\s+java\."],
    "cpp": [r"#include\s*<", r"std::", r"int\s+main\s*\("],
    "c": [r"#include\s*<stdio\.h>", r"printf\s*\(", r"int\s+main\s*\("],
    "go": [r"package\s+main", r"func\s+\w+", r"fmt\.Print"],
    "rust": [r"fn\s+main\s*\(", r"let\s+mut\s+", r"println!\s*\("],
    "ruby": [r"def\s+\w+", r"puts\s+", r"require\s+'"],
    "php": [r"<\?php", r"\$[a-zA-Z_]\w*\s*=", r"echo\s+"],
}

def detect_language(code: str) -> tuple[str, float]:
    scores = {}
    for lang, patterns in LANG_PATTERNS.items():
        hits = sum(1 for p in patterns if re.search(p, code, re.MULTILINE))
        scores[lang] = hits / len(patterns)
    if not scores:
        return "unknown", 0.0
    best = max(scores, key=scores.get)
    return best, round(scores[best], 2)


# ─── Python AST Metrics ────────────────────────────────────────────────────────

def _get_nesting_depth(node: ast.AST, current: int = 0) -> int:
    NESTING_NODES = (ast.If, ast.For, ast.While, ast.With, ast.Try,
                     ast.ExceptHandler, ast.AsyncFor, ast.AsyncWith)
    max_depth = current
    for child in ast.iter_child_nodes(node):
        if isinstance(child, NESTING_NODES):
            depth = _get_nesting_depth(child, current + 1)
            max_depth = max(max_depth, depth)
        else:
            depth = _get_nesting_depth(child, current)
            max_depth = max(max_depth, depth)
    return max_depth


def _count_magic_numbers(tree: ast.AST) -> int:
    magic = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            if node.value not in (0, 1, -1, True, False):
                magic += 1
    return magic


def _get_identifiers(tree: ast.AST) -> list[str]:
    names = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Name, ast.arg)):
            names.append(node.id if isinstance(node, ast.Name) else node.arg)
        elif isinstance(node, ast.FunctionDef):
            names.append(node.name)
        elif isinstance(node, ast.ClassDef):
            names.append(node.name)
    return [n for n in names if n and not n.startswith('_')]


def _get_function_bodies(tree: ast.AST, source_lines: list[str]) -> list[str]:
    bodies = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start = node.lineno - 1
            end = node.end_lineno
            body = "\n".join(source_lines[start:end])
            bodies.append(body)
    return bodies


def _duplicate_score(bodies: list[str]) -> float:
    if len(bodies) < 2:
        return 0.0
    scores = []
    for i in range(len(bodies)):
        for j in range(i + 1, len(bodies)):
            ratio = SequenceMatcher(None, bodies[i], bodies[j]).ratio()
            scores.append(ratio)
    return round(max(scores) if scores else 0.0, 3)


def _count_function_params(tree: ast.AST) -> dict:
    """Return max and avg param count across all functions."""
    param_counts = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            n_args = len(node.args.args) + len(node.args.posonlyargs)
            # subtract 'self'/'cls'
            if node.args.args and node.args.args[0].arg in ('self', 'cls'):
                n_args -= 1
            param_counts.append(n_args)
    return {
        "max_params": max(param_counts) if param_counts else 0,
        "avg_params": round(sum(param_counts) / len(param_counts), 1) if param_counts else 0,
    }


def _count_single_branch_ifs(tree: ast.AST) -> int:
    """Count if-statements that have no else clause (potential guard clause opportunities)."""
    count = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.If) and not node.orelse:
            count += 1
    return count


def _count_return_statements(tree: ast.AST) -> int:
    return sum(1 for node in ast.walk(tree) if isinstance(node, ast.Return))


def _count_wildcard_imports(tree: ast.AST) -> int:
    count = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name == '*':
                    count += 1
    return count


def _count_todo_fixme(source_lines: list[str]) -> int:
    count = 0
    for line in source_lines:
        if re.search(r'\b(TODO|FIXME|HACK|XXX|BUG|NOQA)\b', line, re.IGNORECASE):
            count += 1
    return count


def _count_long_lines(source_lines: list[str], threshold: int = 79) -> int:
    return sum(1 for line in source_lines if len(line.rstrip()) > threshold)


def _god_function_count(tree: ast.AST, threshold: int = 50) -> int:
    """Count functions longer than threshold lines."""
    count = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            length = node.end_lineno - node.lineno + 1
            if length > threshold:
                count += 1
    return count


def analyze_python(code: str) -> dict[str, Any]:
    source_lines = code.splitlines()

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return _regex_fallback(code, "python", str(e))

    # Line counts
    total_lines = len(source_lines)
    blank_lines = sum(1 for l in source_lines if l.strip() == "")
    comment_lines = sum(1 for l in source_lines if l.strip().startswith("#"))
    code_lines = total_lines - blank_lines - comment_lines

    # Functions
    functions = [n for n in ast.walk(tree)
                 if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    function_count = len(functions)
    function_lengths = []
    for fn in functions:
        fn_len = fn.end_lineno - fn.lineno + 1
        function_lengths.append(fn_len)
    avg_function_length = round(sum(function_lengths) / function_count, 1) if function_count else 0

    # Classes
    class_count = sum(1 for n in ast.walk(tree) if isinstance(n, ast.ClassDef))

    # Imports
    import_count = sum(1 for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)))

    # Nesting
    max_nesting = _get_nesting_depth(tree)

    # Magic numbers
    magic_count = _count_magic_numbers(tree)

    # Identifiers
    identifiers = _get_identifiers(tree)
    avg_id_len = round(sum(len(i) for i in identifiers) / len(identifiers), 1) if identifiers else 0

    # Comment ratio
    comment_ratio = round(comment_lines / total_lines, 3) if total_lines else 0

    # Blank line ratio
    blank_ratio = round(blank_lines / total_lines, 3) if total_lines else 0

    # Long lines
    long_lines_count = _count_long_lines(source_lines)

    # TODO/FIXME
    todo_count = _count_todo_fixme(source_lines)

    # Return statements
    return_count = _count_return_statements(tree)

    # Single-branch IFs (no else)
    single_branch_ifs = _count_single_branch_ifs(tree)

    # Wildcard imports
    wildcard_imports = _count_wildcard_imports(tree)

    # God functions
    god_functions = _god_function_count(tree)

    # Params
    param_info = _count_function_params(tree)
    max_params = param_info["max_params"]
    avg_params = param_info["avg_params"]

    # Has __main__ guard
    has_main_guard = any(
        isinstance(n, ast.If) and isinstance(n.test, ast.Compare)
        and any(isinstance(c, ast.Constant) and c.value == '__main__' for c in ast.walk(n.test))
        for n in ast.walk(tree)
    )

    # Cyclomatic complexity via radon
    cyclomatic = 0
    if RADON_AVAILABLE:
        try:
            results = cc_visit(code)
            if results:
                cyclomatic = round(sum(r.complexity for r in results) / len(results), 1)
        except Exception:
            cyclomatic = _regex_complexity(code)
    else:
        cyclomatic = _regex_complexity(code)

    # Halstead volume via radon
    halstead = 0.0
    if RADON_AVAILABLE:
        try:
            h = h_visit(code)
            if h:
                halstead = round(h.total.volume, 2)
        except Exception:
            pass

    # Duplicate score
    bodies = _get_function_bodies(tree, source_lines)
    dup_score = _duplicate_score(bodies)

    return {
        "line_count": total_lines,
        "blank_lines": blank_lines,
        "comment_lines": comment_lines,
        "code_lines": code_lines,
        "function_count": function_count,
        "class_count": class_count,
        "import_count": import_count,
        "avg_function_length": avg_function_length,
        "max_nesting_depth": max_nesting,
        "cyclomatic_complexity": cyclomatic,
        "comment_ratio": comment_ratio,
        "blank_ratio": blank_ratio,
        "avg_identifier_length": avg_id_len,
        "magic_numbers_count": magic_count,
        "halstead_volume": halstead,
        "duplicate_score": dup_score,
        "long_lines_count": long_lines_count,
        "todo_count": todo_count,
        "return_count": return_count,
        "single_branch_ifs": single_branch_ifs,
        "wildcard_imports": wildcard_imports,
        "god_functions": god_functions,
        "max_params": max_params,
        "avg_params": avg_params,
        "has_main_guard": has_main_guard,
        "parse_success": True,
    }


# ─── Regex Fallback Parser ─────────────────────────────────────────────────────

def _regex_complexity(code: str) -> int:
    branches = len(re.findall(r'\b(if|elif|else|for|while|case|catch|except|&&|\|\|)\b', code))
    return branches + 1


def _regex_fallback(code: str, language: str = "unknown", error: str = "") -> dict[str, Any]:
    source_lines = code.splitlines()
    total = len(source_lines)
    blank = sum(1 for l in source_lines if l.strip() == "")
    comment = sum(1 for l in source_lines if l.strip().startswith(("#", "//", "/*", "*", "--")))
    code_ln = total - blank - comment

    fn_patterns = {
        "javascript": r'\bfunction\s+\w+|\w+\s*=\s*(?:async\s*)?\(',
        "typescript": r'\bfunction\s+\w+|(?:public|private|protected|async|static)\s+\w+\s*\(',
        "java": r'(?:public|private|protected|static)\s+\w+\s+\w+\s*\(',
        "cpp": r'\b\w+\s+\w+\s*\([^)]*\)\s*{',
        "go": r'\bfunc\s+\w+',
        "rust": r'\bfn\s+\w+',
        "ruby": r'\bdef\s+\w+',
        "php": r'\bfunction\s+\w+',
    }
    fn_pat = fn_patterns.get(language, r'\bfunction\s+\w+|\bdef\s+\w+|\bfn\s+\w+')
    fn_count = len(re.findall(fn_pat, code, re.MULTILINE))

    # Class count
    class_pat = r'\bclass\s+\w+'
    class_count = len(re.findall(class_pat, code, re.MULTILINE))

    # Import count
    import_pat = r'^\s*(import|require|#include|use\s+\w+)\b'
    import_count = len(re.findall(import_pat, code, re.MULTILINE))

    # Long lines
    long_lines_count = sum(1 for l in source_lines if len(l.rstrip()) > 79)

    # TODO/FIXME
    todo_count = _count_todo_fixme(source_lines)

    # Wildcard imports
    wildcard_imports = len(re.findall(r'import\s+\*|from\s+\S+\s+import\s+\*', code))

    # Nesting via indentation
    indents = []
    for line in source_lines:
        stripped = line.lstrip()
        if stripped:
            indent = (len(line) - len(stripped)) // 4
            indents.append(indent)
    max_nest = max(indents) if indents else 0

    magic = len(re.findall(r'(?<!\w)\d{2,}(?!\w)', code))
    comment_ratio = round(comment / total, 3) if total else 0
    blank_ratio = round(blank / total, 3) if total else 0
    cyclomatic = _regex_complexity(code)

    words = re.findall(r'\b[a-zA-Z_]\w*\b', code)
    avg_id = round(sum(len(w) for w in words) / len(words), 1) if words else 0

    return {
        "line_count": total,
        "blank_lines": blank,
        "comment_lines": comment,
        "code_lines": code_ln,
        "function_count": fn_count,
        "class_count": class_count,
        "import_count": import_count,
        "avg_function_length": round(code_ln / fn_count, 1) if fn_count else 0,
        "max_nesting_depth": max_nest,
        "cyclomatic_complexity": cyclomatic,
        "comment_ratio": comment_ratio,
        "blank_ratio": blank_ratio,
        "avg_identifier_length": avg_id,
        "magic_numbers_count": magic,
        "halstead_volume": 0.0,
        "duplicate_score": 0.0,
        "long_lines_count": long_lines_count,
        "todo_count": todo_count,
        "return_count": 0,
        "single_branch_ifs": 0,
        "wildcard_imports": wildcard_imports,
        "god_functions": 0,
        "max_params": 0,
        "avg_params": 0.0,
        "has_main_guard": False,
        "parse_success": False,
        "parse_error": error,
    }


# ─── Main Entry Point ──────────────────────────────────────────────────────────

def compute_metrics(code: str, language: str = "auto") -> dict[str, Any]:
    if language == "auto" or not language:
        detected_lang, confidence = detect_language(code)
    else:
        detected_lang = language
        confidence = 1.0

    if detected_lang == "python":
        metrics = analyze_python(code)
    else:
        metrics = _regex_fallback(code, detected_lang)

    metrics["detected_language"] = detected_lang
    metrics["language_confidence"] = confidence
    return metrics


# ─── Score Computation ─────────────────────────────────────────────────────────

def compute_readability_score(metrics: dict[str, Any]) -> tuple[int, dict[str, int], str]:
    """Returns (overall_score, dimension_scores, grade)"""

    # Naming clarity (0-100): avg identifier length >=6 is good, <3 is bad
    avg_id = metrics.get("avg_identifier_length", 5)
    naming = min(100, max(0, int((avg_id - 2) / 8 * 100)))

    # Structure quality (0-100): nesting depth <=3 perfect, >=7 terrible
    nesting = metrics.get("max_nesting_depth", 0)
    structure = min(100, max(0, int((7 - nesting) / 6 * 100)))

    # Complexity control (0-100): cyclomatic <=5 perfect, >=20 terrible
    cc = metrics.get("cyclomatic_complexity", 1)
    complexity_s = min(100, max(0, int((20 - cc) / 18 * 100)))

    # Documentation (0-100): comment ratio >=0.2 is great, <0.05 poor
    cr = metrics.get("comment_ratio", 0)
    documentation = min(100, max(0, int(cr / 0.20 * 100)))

    # Consistency — proxy via parse success and identifier variance
    consistency = 85 if metrics.get("parse_success", False) else 65

    # Modularity: function_count > 0 and avg_function_length <= 20
    fn_count = metrics.get("function_count", 0)
    avg_fn = metrics.get("avg_function_length", 0)
    if fn_count == 0:
        modularity = 20
    elif avg_fn <= 20:
        modularity = 90
    elif avg_fn <= 40:
        modularity = 65
    else:
        modularity = 40

    # Magic number penalty
    magic = metrics.get("magic_numbers_count", 0)
    magic_penalty = min(15, magic * 2)

    # Duplicate penalty
    dup = metrics.get("duplicate_score", 0)
    dup_penalty = int(dup * 20)

    # Long lines penalty
    long_lines = metrics.get("long_lines_count", 0)
    long_penalty = min(8, long_lines // 3)

    # Wildcard import penalty
    wildcard_penalty = min(10, metrics.get("wildcard_imports", 0) * 5)

    # God function penalty
    god_penalty = min(10, metrics.get("god_functions", 0) * 5)

    # Weighted composite
    score = (
        naming * 0.20 +
        structure * 0.20 +
        complexity_s * 0.25 +
        documentation * 0.15 +
        consistency * 0.10 +
        modularity * 0.10
    ) - magic_penalty - dup_penalty - long_penalty - wildcard_penalty - god_penalty

    score = max(0, min(100, int(score)))

    # Grade
    if score >= 90:
        grade = "A+"
    elif score >= 80:
        grade = "A"
    elif score >= 70:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 45:
        grade = "D"
    else:
        grade = "F"

    return score, {
        "naming": naming,
        "structure": structure,
        "complexity": complexity_s,
        "documentation": documentation,
        "consistency": consistency,
        "modularity": modularity,
    }, grade
