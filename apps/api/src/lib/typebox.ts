import { Type, type SchemaOptions, type Static, type TSchema } from '@sinclair/typebox';

/**
 * A string enum schema that documents correctly in Swagger.
 *
 * `Type.Union([Type.Literal('a'), Type.Literal('b')])` serializes to
 * `anyOf: [{const:'a'}, {const:'b'}]`, which Swagger UI's parameter dropdown
 * cannot render — it collapses to a single option. A plain `{ type:'string',
 * enum:[…] }` renders every value and validates identically under ajv.
 *
 * `Type.Unsafe` carries the precise TS union type so callers keep full
 * inference (e.g. `Static<typeof S>` is `'a' | 'b'`, not `string`).
 *
 *   const Status = StringEnum(['active', 'closed'] as const);
 *   type Status = Static<typeof Status>; // 'active' | 'closed'
 *
 * `options` takes the usual schema annotations (description, examples, …).
 */
export function StringEnum<T extends readonly string[]>(values: T, options?: SchemaOptions) {
  return Type.Unsafe<T[number]>({ ...options, type: 'string', enum: [...values] });
}

export type { Static, TSchema };
