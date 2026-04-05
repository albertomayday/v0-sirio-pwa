// API Client para SIRIO TPV
// Proporciona funciones para sincronizar con el backend Neon + VeriFactu

class SirioAPIClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
    this.deviceId = this.generateDeviceId()
    this.lastSync = localStorage.getItem('sirio_last_sync') || '1970-01-01T00:00:00.000Z'
    this.syncInterval = 3000
    this.isOnline = navigator.onLine
    this.pendingChanges = []
    
    // Escuchar cambios de conectividad
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('sirio_device_id')
    if (!deviceId) {
      deviceId = 'device_' + crypto.randomUUID()
      localStorage.setItem('sirio_device_id', deviceId)
    }
    return deviceId
  }

  handleOnline() {
    this.isOnline = true
    this.syncPendingChanges()
  }

  handleOffline() {
    this.isOnline = false
  }

  // ── Manejo de errores y retry ─────────────────────────────────────────────
  async fetchWithRetry(url, options = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }
        
        return await response.json()
      } catch (error) {
        if (i === retries) throw error
        await new Promise(r => setTimeout(r, 1000 * (i + 1)))
      }
    }
  }

  // ── Configuración ─────────────────────────────────────────────────────────
  async getConfig() {
    try {
      if (!this.isOnline) return this.getLocalConfig()
      const data = await this.fetchWithRetry(`${this.baseUrl}/config`)
      localStorage.setItem('sirio_cfg', JSON.stringify(data))
      return data
    } catch (error) {
      console.warn('Using local config:', error.message)
      return this.getLocalConfig()
    }
  }

  async updateConfig(config) {
    localStorage.setItem('sirio_cfg', JSON.stringify(config))
    
    if (!this.isOnline) {
      this.queueChange('config', 'update', '1', config)
      return { success: true, data: config, offline: true }
    }
    
    try {
      return await this.fetchWithRetry(`${this.baseUrl}/config`, {
        method: 'POST',
        body: JSON.stringify(config)
      })
    } catch (error) {
      this.queueChange('config', 'update', '1', config)
      return { success: true, data: config, offline: true }
    }
  }

  // ── Categorías ────────────────────────────────────────────────────────────
  async getCategorias() {
    try {
      if (!this.isOnline) return this.getLocalCategorias()
      const data = await this.fetchWithRetry(`${this.baseUrl}/categorias`)
      localStorage.setItem('sirio_cats', JSON.stringify(data))
      return data
    } catch (error) {
      return this.getLocalCategorias()
    }
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  async getProductos() {
    try {
      if (!this.isOnline) return this.getLocalProductos()
      const data = await this.fetchWithRetry(`${this.baseUrl}/productos`)
      localStorage.setItem('sirio_prods', JSON.stringify(data))
      return data
    } catch (error) {
      return this.getLocalProductos()
    }
  }

  async createProducto(producto) {
    if (!this.isOnline) {
      const tempId = Date.now()
      this.queueChange('productos', 'insert', tempId.toString(), producto)
      return { ...producto, id: tempId, offline: true }
    }
    
    try {
      const result = await this.fetchWithRetry(`${this.baseUrl}/productos`, {
        method: 'POST',
        body: JSON.stringify(producto)
      })
      return result.data || result
    } catch (error) {
      const tempId = Date.now()
      this.queueChange('productos', 'insert', tempId.toString(), producto)
      return { ...producto, id: tempId, offline: true }
    }
  }

  async updateProducto(id, producto) {
    if (!this.isOnline) {
      this.queueChange('productos', 'update', id.toString(), { id, ...producto })
      return { ...producto, id, offline: true }
    }
    
    try {
      const result = await this.fetchWithRetry(`${this.baseUrl}/productos`, {
        method: 'PUT',
        body: JSON.stringify({ id, ...producto })
      })
      return result.data || result
    } catch (error) {
      this.queueChange('productos', 'update', id.toString(), { id, ...producto })
      return { ...producto, id, offline: true }
    }
  }

  // ── Mesas ─────────────────────────────────────────────────────────────────
  async getMesas() {
    try {
      if (!this.isOnline) return this.getLocalMesas()
      const data = await this.fetchWithRetry(`${this.baseUrl}/mesas`)
      localStorage.setItem('sirio_mesas', JSON.stringify(data))
      return data
    } catch (error) {
      return this.getLocalMesas()
    }
  }

  async updateMesa(id, mesa) {
    if (!this.isOnline) {
      this.queueChange('mesas', 'update', id.toString(), { id, ...mesa })
      return { ...mesa, id, offline: true }
    }
    
    try {
      return await this.fetchWithRetry(`${this.baseUrl}/mesas`, {
        method: 'PUT',
        body: JSON.stringify({ id, ...mesa })
      })
    } catch (error) {
      this.queueChange('mesas', 'update', id.toString(), { id, ...mesa })
      return { ...mesa, id, offline: true }
    }
  }

  // ── Tickets VeriFactu ─────────────────────────────────────────────────────
  async getTickets(options = {}) {
    const { limit = 50, offset = 0, serie, desde, hasta } = options
    
    try {
      let url = `${this.baseUrl}/tickets?limit=${limit}&offset=${offset}`
      if (serie) url += `&serie=${serie}`
      if (desde) url += `&desde=${desde}`
      if (hasta) url += `&hasta=${hasta}`
      
      const result = await this.fetchWithRetry(url)
      return result.data || result
    } catch (error) {
      return []
    }
  }

  async createTicket(ticketData) {
    // Los tickets VeriFactu requieren conexión para mantener integridad del hash
    if (!this.isOnline) {
      await this.saveTicketOffline(ticketData)
      return { 
        ...ticketData, 
        offline: true, 
        warning: 'Ticket guardado localmente. Se enviará al servidor cuando haya conexión.' 
      }
    }
    
    try {
      const result = await this.fetchWithRetry(`${this.baseUrl}/tickets`, {
        method: 'POST',
        body: JSON.stringify(ticketData)
      })
      return result.data || result
    } catch (error) {
      await this.saveTicketOffline(ticketData)
      return { 
        ...ticketData, 
        offline: true,
        error: error.message 
      }
    }
  }

  // ── Verificación VeriFactu ────────────────────────────────────────────────
  async verificarIntegridad(serie = 'A') {
    try {
      return await this.fetchWithRetry(`${this.baseUrl}/verifactu/verificar?serie=${serie}`)
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // ── Sincronización ────────────────────────────────────────────────────────
  async sync() {
    if (!this.isOnline) return { success: false, offline: true }
    
    try {
      const result = await this.fetchWithRetry(`${this.baseUrl}/sync`, {
        method: 'POST',
        body: JSON.stringify({
          lastSync: this.lastSync,
          deviceId: this.deviceId,
          changes: this.pendingChanges
        })
      })
      
      if (result.success) {
        this.lastSync = result.serverTime
        localStorage.setItem('sirio_last_sync', this.lastSync)
        this.pendingChanges = []
        this.savePendingChanges()
      }
      
      return result
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async syncPendingChanges() {
    if (this.pendingChanges.length === 0) return
    await this.sync()
    
    // Sincronizar tickets offline
    const offlineTickets = await this.getOfflineTickets()
    for (const ticket of offlineTickets) {
      try {
        await this.createTicket(ticket)
        await this.removeOfflineTicket(ticket.localId)
      } catch (error) {
        console.warn('Failed to sync offline ticket:', error)
      }
    }
  }

  // ── Cola de cambios offline ───────────────────────────────────────────────
  queueChange(table, operation, recordId, data) {
    this.pendingChanges.push({
      table_name: table,
      operation_type: operation,
      record_id: recordId,
      data,
      client_timestamp: new Date().toISOString()
    })
    this.savePendingChanges()
  }

  savePendingChanges() {
    localStorage.setItem('sirio_pending_changes', JSON.stringify(this.pendingChanges))
  }

  loadPendingChanges() {
    const data = localStorage.getItem('sirio_pending_changes')
    this.pendingChanges = data ? JSON.parse(data) : []
  }

  // ── Almacenamiento local (fallback) ───────────────────────────────────────
  getLocalConfig() {
    const data = localStorage.getItem('sirio_cfg')
    return data ? JSON.parse(data) : {
      biz_name: 'SIRIO TPV',
      biz_type: 'restaurante',
      iva: 21,
      currency: '€',
      iva_incluido: true,
      use_mesas: true,
      use_inventario: true,
      offline_mode: true,
      stock_alert: true,
      pay_methods: { efectivo: true, tarjeta: true, bizum: true },
      num_mesas: 10,
      mesa_prefix: 'Mesa '
    }
  }

  getLocalCategorias() {
    const data = localStorage.getItem('sirio_cats')
    return data ? JSON.parse(data) : [
      { id: 'all', label: 'Todo' },
      { id: 'bebidas', label: 'Bebidas' },
      { id: 'comida', label: 'Comida' },
      { id: 'otros', label: 'Otros' }
    ]
  }

  getLocalProductos() {
    const data = localStorage.getItem('sirio_prods')
    return data ? JSON.parse(data) : []
  }

  getLocalMesas() {
    const data = localStorage.getItem('sirio_mesas')
    return data ? JSON.parse(data) : []
  }

  // ── IndexedDB para tickets offline ────────────────────────────────────────
  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SirioTPV', 2)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('offline_tickets')) {
          db.createObjectStore('offline_tickets', { keyPath: 'localId', autoIncrement: true })
        }
      }
    })
  }

  async saveTicketOffline(ticket) {
    const db = await this.openIndexedDB()
    const tx = db.transaction('offline_tickets', 'readwrite')
    const store = tx.objectStore('offline_tickets')
    store.add({ ...ticket, localId: Date.now(), savedAt: new Date().toISOString() })
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }

  async getOfflineTickets() {
    const db = await this.openIndexedDB()
    const tx = db.transaction('offline_tickets', 'readonly')
    const store = tx.objectStore('offline_tickets')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async removeOfflineTicket(localId) {
    const db = await this.openIndexedDB()
    const tx = db.transaction('offline_tickets', 'readwrite')
    const store = tx.objectStore('offline_tickets')
    store.delete(localId)
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }

  // ── Sincronización periódica ──────────────────────────────────────────────
  startAutoSync() {
    this.loadPendingChanges()
    
    setInterval(() => {
      if (this.isOnline) {
        this.sync()
      }
    }, this.syncInterval)
    
    // Sync inicial
    if (this.isOnline) {
      setTimeout(() => this.sync(), 1000)
    }
  }
}

// Instancia global
window.sirioAPI = new SirioAPIClient()
window.sirioAPI.startAutoSync()
