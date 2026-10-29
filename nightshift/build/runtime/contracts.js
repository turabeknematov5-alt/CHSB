export function validateAnswer(raw, q) {
    const a = raw;
    if (!a || a.questionId !== q.questionId || !['answered', 'needs_input'].includes(a.status) || !Array.isArray(a.selectedChoiceIds) || typeof a.explanation !== 'string' || !(a.uncertainty === null || typeof a.uncertainty === 'string'))
        throw Error('Malformed or stale solver response');
    const ids = new Set(q.choices.map(c => c.id));
    if (new Set(a.selectedChoiceIds).size !== a.selectedChoiceIds.length || a.selectedChoiceIds.some(id => !ids.has(id)))
        throw Error('Unknown or duplicate choice ID');
    if (a.status === 'needs_input' ? a.selectedChoiceIds.length !== 0 : a.selectedChoiceIds.length < 1 || (q.selectionMode === 'single' && a.selectedChoiceIds.length !== 1))
        throw Error('Incompatible selection count');
    return a;
}
