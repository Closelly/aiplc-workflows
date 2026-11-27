import Ajv, { type ValidateFunction } from "ajv";
import { Blocked, readJson } from "./files";

export class Schemas {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });
  private readonly validators = new Map<string, ValidateFunction>();
  constructor(readonly root: string) {}

  compile(name: string): ValidateFunction {
    let validator = this.validators.get(name);
    if (!validator) {
      validator = this.ajv.compile(readJson(this.root, `${name}.schema.json`) as object);
      this.validators.set(name, validator);
    }
    return validator;
  }

  assert<T>(name: string, data: unknown, location = name): T {
    const validate = this.compile(name);
    if (!validate(data)) {
      throw new Blocked(`${location}: ${this.ajv.errorsText(validate.errors, { separator: "; " })}`);
    }
    return data as T;
  }

  read<T>(name: string, root: string, path: string): T {
    return this.assert<T>(name, readJson(root, path), path);
  }
}
