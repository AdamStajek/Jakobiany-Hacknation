from functools import cache
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

from store import Problem

packaged = Path(__file__).with_name("openapi.yaml")
SPEC = yaml.safe_load(
    (
        packaged
        if packaged.exists()
        else Path(__file__).resolve().parent.parent / "docs/openapi.yaml"
    ).read_text(encoding="utf-8")
)
SCHEMAS = SPEC["components"]["schemas"]


def resolve(item):
    if "$ref" in item:
        target = SPEC
        for key in item["$ref"].split("/")[1:]:
            target = target[key]
        return target
    return item


@cache
def schema_fields(name):
    schema = SCHEMAS[name]
    return set(schema.get("properties", {})).union(
        *(
            set(resolve(part).get("properties", {}))
            | (schema_fields(part["$ref"].split("/")[-1]) if "$ref" in part else set())
            for part in schema.get("allOf", [])
        )
    )


def validate(value, schema):
    if isinstance(schema, str):
        schema = {"$ref": f"#/components/schemas/{schema}"}
    validator = Draft202012Validator(
        {**schema, "components": SPEC["components"]}, format_checker=FormatChecker()
    )
    errors = list(validator.iter_errors(value))
    if errors:
        raise Problem(
            422,
            "validation_error",
            "Niepoprawne dane żądania.",
            [
                {
                    "field": ".".join(map(str, error.absolute_path)),
                    "message": error.message,
                }
                for error in errors[:15]
            ],
        )
    return value
