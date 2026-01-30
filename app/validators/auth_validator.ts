import Vine from '@vinejs/vine'

export const loginValidator = Vine.object({
  email: Vine.string().required().email().max(255),
  password: Vine.string().required()
}).defined()

export const forgotPasswordValidator = Vine.object({
  email: Vine.string().required().email().max(255)
}).defined()

export const resetPasswordValidator = Vine.object({
  token: Vine.string().required(),
  password: Vine.string().required().min(8),
  passwordConfirmation: Vine.string().required()
    .test(
      'matchesPassword',
      'Passwords must match',
      (value, { parent }) => value === parent.password
    )
}).defined()