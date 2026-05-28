import { authorizeRoles } from './authorizeRoles'

export const isAdmin = authorizeRoles('admin')
