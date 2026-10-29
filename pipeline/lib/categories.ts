import type { CategoryId } from '../../lib/types';
import { CATEGORY_RULES } from '../config';
import { normalizeText } from '../normalize/parse';
import type { CategoryPath } from '../sources/vtex';

/** Elige las categorías de la tienda que corresponden a una categoría nuestra (ver CATEGORY_RULES). */
export function selectCategories(tree: CategoryPath[], category: CategoryId): CategoryPath[] {
  const rule = CATEGORY_RULES[category];
  const key = (p: CategoryPath) => p.ids.join('/');
  const matched = tree.filter((p) => {
    const name = normalizeText(p.names.at(-1) ?? '');
    const full = normalizeText(p.names.join(' > '));
    return rule.node.test(name) && !rule.excludeNode?.test(name) && !rule.excludePath.test(full);
  });
  const keys = new Set(matched.map(key));
  // quedarse con los más específicos: descartar un nodo si algún descendiente también fue elegido
  return matched.filter((p) => !matched.some((q) => q !== p && q.ids.length > p.ids.length && key(q).startsWith(`${key(p)}/`) && keys.has(key(q))));
}
