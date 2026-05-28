import { authorizeRoles } from '../authorizeRoles'

export const isB2BAdmin = authorizeRoles('b2b_admin')
