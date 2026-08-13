const COLLECTION_TAB_ID = 'collection';
const AUTOMATION_TAB_ID = 'automation';
const MAIL_TAB_ID = 'mail';
const XHS_TAB_ID = 'xhs-profile';

class BrowserTabRegistry {
  constructor() {
    this._tabs = new Map();
    this._activeId = '';
  }

  add(tab) {
    const id = String(tab?.id || '').trim();
    if (!id) throw new Error('tab id is required');
    if (this._tabs.has(id)) throw new Error(`tab already exists: ${id}`);
    const record = {
      id,
      role: String(tab?.role || 'manual'),
      title: String(tab?.title || '新标签页'),
      closable: tab?.closable !== false
    };
    this._tabs.set(id, record);
    if (!this._activeId) this._activeId = id;
    return { ...record };
  }

  has(id) {
    return this._tabs.has(String(id || ''));
  }

  activate(id) {
    const safeId = String(id || '');
    if (!this._tabs.has(safeId)) throw new Error(`tab not found: ${safeId}`);
    this._activeId = safeId;
    return this.get(safeId);
  }

  close(id) {
    const safeId = String(id || '');
    const tab = this._tabs.get(safeId);
    if (!tab) return null;
    if (!tab.closable) throw new Error(`tab cannot be closed: ${safeId}`);
    this._tabs.delete(safeId);
    if (this._activeId === safeId) {
      this._activeId = this._tabs.has(COLLECTION_TAB_ID)
        ? COLLECTION_TAB_ID
        : (this._tabs.keys().next().value || '');
    }
    return { ...tab };
  }

  get(id) {
    const tab = this._tabs.get(String(id || ''));
    return tab ? { ...tab } : null;
  }

  get activeId() {
    return this._activeId;
  }

  list() {
    return Array.from(this._tabs.values()).map((tab) => ({
      ...tab,
      active: tab.id === this._activeId
    }));
  }

  clear() {
    this._tabs.clear();
    this._activeId = '';
  }
}

module.exports = {
  BrowserTabRegistry,
  COLLECTION_TAB_ID,
  AUTOMATION_TAB_ID,
  MAIL_TAB_ID,
  XHS_TAB_ID
};
