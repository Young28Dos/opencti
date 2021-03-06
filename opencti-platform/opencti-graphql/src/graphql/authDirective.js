/* eslint-disable no-underscore-dangle,no-param-reassign */
import { SchemaDirectiveVisitor } from 'graphql-tools';
import { append, includes, map } from 'ramda';
import { defaultFieldResolver } from 'graphql';
import { ForbiddenAccess } from '../config/errors';
import { ROLE_USER } from '../config/conf';

export const AUTH_DIRECTIVE = 'auth';

// Auth code get from https://www.apollographql.com/docs/graphql-tools/schema-directives.html
// Use object mutation and not conform with eslint but it works pretty well.
class AuthDirective extends SchemaDirectiveVisitor {
  visitObject(type) {
    this.ensureFieldsWrapped(type);
    // noinspection JSUndefinedPropertyAssignment
    type._requiredAuthRole = this.args.for;
  }

  visitFieldDefinition(field, details) {
    this.ensureFieldsWrapped(details.objectType);
    field._requiredAuthRole = this.args.for;
  }

  authenticationControl(func, args, objectType, field) {
    // Get the required Role from the field first, falling back
    // to the objectType if no Role is required by the field:
    const requiredRole = field._requiredAuthRole || objectType._requiredAuthRole || ROLE_USER;
    // If a role is required
    const context = args[2];
    const { user } = context;
    if (!user) throw new ForbiddenAccess(); // User must be authenticated.
    const roles = append(ROLE_USER, user.grant); // Inject the basic ROLE_USER
    if (!includes(requiredRole, roles)) throw new ForbiddenAccess();
    return func.apply(this, args);
  }

  ensureFieldsWrapped(objectType) {
    const $this = this;
    if (objectType._authFieldsWrapped) return;
    objectType._authFieldsWrapped = true;
    const fields = objectType.getFields();
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      const { directives } = field.astNode;
      const directiveNames = map(d => d.name.value, directives);
      const { resolve = defaultFieldResolver, subscribe } = field;
      field.resolve = (...args) =>
        includes(AUTH_DIRECTIVE, directiveNames)
          ? $this.authenticationControl(resolve, args, objectType, field)
          : resolve.apply($this, args);
      if (subscribe) {
        field.subscribe = (...args) => $this.authenticationControl(subscribe, args, objectType, field);
      }
    });
  }
}

export default AuthDirective;
