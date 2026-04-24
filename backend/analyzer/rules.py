"""
Rule-based tip engine — deterministic, zero LLM tokens.
20+ rules covering structure, naming, complexity, documentation, and safety.
"""
from typing import Any

SEVERITY_ORDER = {"critical": 0, "warning": 1, "suggestion": 2}

RULES = [
    # ── Structure ──────────────────────────────────────────────────────────────
    {
        "id": "tip_nesting",
        "trigger_key": "max_nesting_depth",
        "threshold": 4,
        "comparator": ">",
        "severity": "critical",
        "category": "structure",
        "effort": "medium",
        "title": "Nesting depth exceeds 4 levels",
        "detail": (
            "Nesting depth of {val} detected. Use early-return guard clauses: "
            "instead of `if condition: <deep block>`, write `if not condition: return` "
            "at the top of the function, then write the happy-path flat. "
            "Extract inner blocks into named helper functions."
        ),
        "example": "# Before:\ndef f(x):\n    if x:\n        for i in x:\n            if i > 0:\n                ...\n\n# After (guard clauses):\ndef f(x):\n    if not x:\n        return\n    for i in x:\n        if i <= 0:\n            continue\n        ...",
    },
    {
        "id": "tip_single_branch_if",
        "trigger_key": "single_branch_ifs",
        "threshold": 5,
        "comparator": ">",
        "severity": "suggestion",
        "category": "structure",
        "effort": "low",
        "title": "Many single-branch if statements",
        "detail": (
            "{val} if-statements have no else clause. Consider converting them to "
            "guard clauses (early returns) or using ternary expressions for simple cases. "
            "This can flatten your control flow significantly."
        ),
        "example": "# Before:\ndef process(value):\n    result = None\n    if value > 0:\n        result = value * 2\n    return result\n\n# After:\ndef process(value):\n    if value <= 0:\n        return None\n    return value * 2",
    },
    # ── Function Design ────────────────────────────────────────────────────────
    {
        "id": "tip_fn_length",
        "trigger_key": "avg_function_length",
        "threshold": 30,
        "comparator": ">",
        "severity": "warning",
        "category": "modularity",
        "effort": "medium",
        "title": "Functions are too long",
        "detail": (
            "Functions average {val} lines. Apply the Single Responsibility Principle: "
            "each function should do ONE thing. Identify logical sub-steps and extract them "
            "into helper functions with descriptive names. Target ≤20 lines per function."
        ),
        "example": "# Split long functions:\n# BEFORE: def process_order(order): # 60 lines\n\n# AFTER:\ndef validate_order(order): ...\ndef calculate_total(order): ...\ndef apply_discounts(order, total): ...\ndef process_order(order):\n    validate_order(order)\n    total = calculate_total(order)\n    return apply_discounts(order, total)",
    },
    {
        "id": "tip_god_function",
        "trigger_key": "god_functions",
        "threshold": 0,
        "comparator": ">",
        "severity": "critical",
        "category": "modularity",
        "effort": "high",
        "title": "God function detected (>50 lines)",
        "detail": (
            "{val} function(s) exceed 50 lines — these are 'God functions' that violate SRP. "
            "They are nearly impossible to test, reuse, or understand. "
            "Break them into multiple single-purpose functions, each testable in isolation."
        ),
        "example": "# A 60-line process_data() should become:\n# load_data() + validate_data() + transform_data() + save_data()",
    },
    {
        "id": "tip_too_many_params",
        "trigger_key": "max_params",
        "threshold": 5,
        "comparator": ">",
        "severity": "warning",
        "category": "structure",
        "effort": "medium",
        "title": "Function has too many parameters",
        "detail": (
            "A function has {val} parameters. Functions with >5 parameters are hard to call "
            "correctly and suggest the function does too much. "
            "Group related parameters into a dataclass or dict, or split the function."
        ),
        "example": "# Before:\ndef create_user(name, email, age, role, team, department, salary):\n    ...\n\n# After:\n@dataclass\nclass UserProfile:\n    name: str\n    email: str\n    age: int\n    role: str\n\ndef create_user(profile: UserProfile, team: str): ...",
    },
    {
        "id": "tip_no_functions",
        "trigger_key": "function_count",
        "threshold": 1,
        "comparator": "<",
        "severity": "critical",
        "category": "modularity",
        "effort": "high",
        "title": "No functions detected",
        "detail": (
            "No functions found. Structure all logic into named functions "
            "for reusability, testability, and readability. "
            "Even one-file scripts benefit from a `main()` function and helper functions."
        ),
        "example": "# Wrap your script:\ndef process_data(data): ...\ndef display_results(results): ...\ndef main():\n    data = load()\n    results = process_data(data)\n    display_results(results)\n\nif __name__ == '__main__':\n    main()",
    },
    # ── Naming ────────────────────────────────────────────────────────────────
    {
        "id": "tip_short_names",
        "trigger_key": "avg_identifier_length",
        "threshold": 4,
        "comparator": "<",
        "severity": "warning",
        "category": "naming",
        "effort": "medium",
        "title": "Identifier names are too short",
        "detail": (
            "Variable names average {val} characters — too abbreviated to be self-documenting. "
            "Replace `d`, `tmp`, `x`, `lst` with `user_data`, `temp_result`, "
            "`coordinate`, `user_list`. "
            "Code is read 10x more than it is written — name for the reader."
        ),
        "example": "# Before: d, t, p, lst\n# After: user_data, timeout_seconds, payment_total, user_list",
    },
    {
        "id": "tip_magic_numbers",
        "trigger_key": "magic_numbers_count",
        "threshold": 5,
        "comparator": ">",
        "severity": "critical",
        "category": "naming",
        "effort": "low",
        "title": "Magic numbers detected",
        "detail": (
            "{val} magic numbers found. Replace all with named constants. "
            "A reader seeing `timeout > 3600` has no idea why 3600. "
            "With `timeout > MAX_SESSION_SECONDS` the intent is instantly clear. "
            "Group constants at the top of the module or in a `constants.py`."
        ),
        "example": "# Before:\nif retries > 3:\n    sleep(60)\n\n# After:\nMAX_RETRIES = 3\nRETRY_WAIT_SECONDS = 60\nif retries > MAX_RETRIES:\n    sleep(RETRY_WAIT_SECONDS)",
    },
    # ── Documentation ─────────────────────────────────────────────────────────
    {
        "id": "tip_comments",
        "trigger_key": "comment_ratio",
        "threshold": 0.10,
        "comparator": "<",
        "severity": "warning",
        "category": "documentation",
        "effort": "low",
        "title": "Insufficient documentation",
        "detail": (
            "Only {val}% of lines are comments. Add docstrings to every public function "
            "explaining the WHY (not just what it does). "
            "Use Google-style docstrings: Args, Returns, Raises sections. "
            "Future-you will thank present-you."
        ),
        "example": 'def calculate_discount(price, user_tier):\n    """\n    Apply tier-based discount to a price.\n    \n    Args:\n        price: Original price in USD.\n        user_tier: One of (\'basic\', \'premium\', \'enterprise\').\n    Returns:\n        Discounted price as float.\n    """\n    ...',
    },
    {
        "id": "tip_todo_fixme",
        "trigger_key": "todo_count",
        "threshold": 3,
        "comparator": ">",
        "severity": "warning",
        "category": "documentation",
        "effort": "high",
        "title": "Multiple TODO/FIXME markers",
        "detail": (
            "{val} TODO/FIXME comments found. These represent unresolved technical debt. "
            "Each TODO should become a tracked issue in your project management tool, "
            "not live forever in source code. Resolve the top 3 before shipping."
        ),
    },
    # ── Complexity ────────────────────────────────────────────────────────────
    {
        "id": "tip_complexity",
        "trigger_key": "cyclomatic_complexity",
        "threshold": 10,
        "comparator": ">",
        "severity": "critical",
        "category": "complexity",
        "effort": "high",
        "title": "High cyclomatic complexity",
        "detail": (
            "Cyclomatic complexity of {val} detected (ideal ≤5, high risk ≥10). "
            "This means the function has many independent execution paths, "
            "making full test coverage exponentially harder. "
            "Decompose complex conditionals into guard clauses or the Strategy pattern."
        ),
        "example": "# Instead of a 15-branch if/elif chain,\n# use a dispatch table or Strategy pattern:\nHANDLERS = {\n    'create': handle_create,\n    'update': handle_update,\n    'delete': handle_delete,\n}\nhandler = HANDLERS.get(action)\nif handler:\n    handler(payload)",
    },
    {
        "id": "tip_halstead",
        "trigger_key": "halstead_volume",
        "threshold": 1000,
        "comparator": ">",
        "severity": "suggestion",
        "category": "complexity",
        "effort": "medium",
        "title": "High Halstead Volume",
        "detail": (
            "Halstead volume of {val} indicates a large operator/operand surface area. "
            "This correlates with higher defect rates. "
            "Simplify compound boolean expressions, reduce chained method calls, "
            "and break large expressions into named intermediate variables."
        ),
        "example": "# Before:\nresult = (a * b + c) / (d - e * f) if (g > h and i < j) else k\n\n# After:\nnumerator = a * b + c\ndenominator = d - e * f\ncondition = g > h and i < j\nresult = numerator / denominator if condition else k",
    },
    # ── Code Quality ──────────────────────────────────────────────────────────
    {
        "id": "tip_duplicates",
        "trigger_key": "duplicate_score",
        "threshold": 0.6,
        "comparator": ">",
        "severity": "warning",
        "category": "modularity",
        "effort": "medium",
        "title": "Code duplication detected",
        "detail": (
            "Duplicate logic score of {val} detected. "
            "Extract repeated logic into shared utility functions (DRY principle). "
            "If two functions look 60%+ similar, they share a common abstraction "
            "waiting to be named and extracted."
        ),
    },
    {
        "id": "tip_long_lines",
        "trigger_key": "long_lines_count",
        "threshold": 5,
        "comparator": ">",
        "severity": "suggestion",
        "category": "consistency",
        "effort": "low",
        "title": "Lines exceed 79 characters",
        "detail": (
            "{val} lines exceed 79 characters (PEP 8 standard). Long lines force "
            "horizontal scrolling and make side-by-side diffs painful. "
            "Break long expressions using parentheses or explicit line continuations. "
            "Configure your editor to show a ruler at column 79."
        ),
        "example": "# Before (120 chars):\nresult = some_function(very_long_argument_one, very_long_argument_two, another_long_argument)\n\n# After:\nresult = some_function(\n    very_long_argument_one,\n    very_long_argument_two,\n    another_long_argument,\n)",
    },
    {
        "id": "tip_wildcard_imports",
        "trigger_key": "wildcard_imports",
        "threshold": 0,
        "comparator": ">",
        "severity": "critical",
        "category": "consistency",
        "effort": "low",
        "title": "Wildcard imports detected",
        "detail": (
            "{val} wildcard import(s) found (`from x import *`). "
            "These pollute the namespace, make it impossible to know where names come from, "
            "and can cause silent name collisions. "
            "Always import explicitly: `from module import ClassA, function_b`."
        ),
        "example": "# Before:\nfrom utils import *\nfrom helpers import *\n\n# After:\nfrom utils import format_date, parse_config\nfrom helpers import retry_with_backoff",
    },
    {
        "id": "tip_no_main_guard",
        "trigger_key": "has_main_guard",
        "threshold": True,
        "comparator": "==",
        "negate": True,
        "severity": "suggestion",
        "category": "structure",
        "effort": "low",
        "title": "Missing __main__ guard",
        "detail": (
            "Script-level code runs when the file is imported as a module. "
            "Wrap top-level execution in `if __name__ == '__main__': main()`. "
            "This makes the file importable and testable as a module."
        ),
        "example": "def main():\n    # all your script logic here\n    pass\n\nif __name__ == '__main__':\n    main()",
    },
    {
        "id": "tip_high_return_count",
        "trigger_key": "return_count",
        "threshold": 10,
        "comparator": ">",
        "severity": "suggestion",
        "category": "structure",
        "effort": "medium",
        "title": "High number of return statements",
        "detail": (
            "{val} return statements detected. While early returns (guard clauses) are good, "
            "too many scattered returns across a large function makes logic hard to trace. "
            "Ensure each function has a clear single exit point where possible, "
            "or restructure using guard clauses at the top only."
        ),
    },
    {
        "id": "tip_many_imports",
        "trigger_key": "import_count",
        "threshold": 15,
        "comparator": ">",
        "severity": "suggestion",
        "category": "modularity",
        "effort": "high",
        "title": "Too many imports",
        "detail": (
            "{val} imports detected. A high import count can indicate this module "
            "has too many responsibilities (violating SRP). "
            "Consider splitting this file into focused sub-modules. "
            "Also check for unused imports — run `autoflake` or `pylint` to find them."
        ),
    },
]


def _format_val(key: str, val: Any) -> str:
    if "ratio" in key:
        return f"{round(val * 100, 1)}"
    if "score" in key:
        return f"{round(val, 2)}"
    if "length" in key or "volume" in key:
        return f"{round(val, 1)}"
    return str(val)


def evaluate_rules(metrics: dict[str, Any]) -> list[dict]:
    tips = []
    for rule in RULES:
        key = rule["trigger_key"]
        val = metrics.get(key)
        if val is None:
            continue

        cmp = rule["comparator"]
        thresh = rule["threshold"]
        negate = rule.get("negate", False)

        triggered = (
            (cmp == ">" and val > thresh) or
            (cmp == "<" and val < thresh) or
            (cmp == "==" and val == thresh)
        )

        if negate:
            triggered = not triggered

        if triggered:
            fmt_val = _format_val(key, val)
            tip = {
                "id": rule["id"],
                "severity": rule["severity"],
                "category": rule["category"],
                "effort": rule["effort"],
                "title": rule["title"],
                "detail": rule["detail"].replace("{val}", fmt_val),
                "metric_key": key,
                "metric_value": val,
            }
            if "example" in rule:
                tip["example"] = rule["example"]
            tips.append(tip)

    # Sort: critical first
    tips.sort(key=lambda t: SEVERITY_ORDER.get(t["severity"], 99))
    return tips
