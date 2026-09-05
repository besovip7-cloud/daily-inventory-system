// المدير والموظف المرتبطين بفرع يشوفون فرعهم فقط
// الأدمن والمحاسب يشوفون كل الفروع
export function visibleBranches(user, branches) {
  if (!user || user.role === 'admin' || user.role === 'accountant') return branches
  if (user.branch_id) return branches.filter(b => b.id === user.branch_id)
  return branches
}

export function isBranchLocked(user) {
  return !!user && !['admin', 'accountant'].includes(user.role) && !!user.branch_id
}
