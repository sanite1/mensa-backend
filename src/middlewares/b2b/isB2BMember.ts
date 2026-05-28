import { authorizeRoles } from '../authorizeRoles'

export const isB2BMember = authorizeRoles('b2b_admin', 'b2b_member')
