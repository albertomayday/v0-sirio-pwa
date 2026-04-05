// API Client para SIRIO TPV
// Proporciona funciones para sincronizar con el backend Neon

class SirioAPIClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl
    this.deviceId = this.generateDeviceId()
    this.lastSync = 0
    this.syncInterval = 3000 // 3 segundos
  }

  generateDeviceId() {
    let deviceId = localStorage.getItem('sirio_device_id')
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
      localStorage.setItem('sirio_device_id', deviceId)
    }
    return deviceId
  }

  // Configuración
  async getConfig() {
    try {
      const response = await fetch(`${this.baseUrl}/config`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching config:', error)
      return this.getLocalConfig()
    }
  }

  async updateConfig(config) {
    try {
      const response = await fetch(`${this.baseUrl}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const result = await response.json()
      localStorage.setItem('sirio_cfg', JSON.stringify(config))
      return result
    } catch (error) {
      console.error('Error updating config:', error)
      localStorage.setItem('sirio_cfg', JSON.stringify(config))
      return { success: true, data: config }
    }
  }

  // Categorías
  async getCategorias() {
    try {
      const response = await fetch(`${this.baseUrl}/categorias`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching categorias:', error)
      return this.getLocalCategorias()
    }
  }

  async createCategoria(categoria) {
    try {
      const response = await fetch(`${this.baseUrl}/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoria),
      })
      return await response.json()
    } catch (error) {
      console.error('Error creating categoria:', error)
      return categoria
    }
  }

  async updateCategoria(id, categoria) {
    try {
      const response = await fetch(`${this.baseUrl}/categorias`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...categoria }),
      })
      return await response.json()
    } catch (error) {
      console.error('Error updating categoria:', error)
      return categoria
    }
  }

  // Productos
  async getProductos() {
    try {
      const response = await fetch(`${this.baseUrl}/productos`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching productos:', error)
      return this.getLocalProductos()
    }
  }

  async createProducto(producto) {
    try {
      const response = await fetch(`${this.baseUrl}/productos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(producto),
      })
      return await response.json()
    } catch (error) {
      console.error('Error creating producto:', error)
      return producto
    }
  }

  async updateProducto(id, producto) {
    try {
      const response = await fetch(`${this.baseUrl}/productos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...producto }),
      })
      return await response.json()
    } catch (error) {
      console.error('Error updating producto:', error)
      return producto
    }
  }

  // Mesas
  async getMesas() {
    try {
      const response = await fetch(`${this.baseUrl}/mesas`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching mesas:', error)
      return this.getLocalMesas()
    }
  }

  async updateMesa(id, mesa) {
    try {
      const response = await fetch(`${this.baseUrl}/mesas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...mesa }),
      })
      return await response.json()
    } catch (error) {
      console.error('Error updating mesa:', error)
      return mesa
    }
  }

  // Tickets
  async getTickets(limit = 100, offset = 0) {
    try {
      const response = await fetch(
        `${this.baseUrl}/tickets?limit=${limit}&offset=${offset}`
      )
      return await response.json()
    } catch (error) {
      console.error('Error fetching tickets:', error)
      return []
    }
  }

  async createTicket(ticket) {
    try {
      const response = await fetch(`${this.baseUrl}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      })
      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error creating ticket:', error)
      // En modo offline, guardar en IndexedDB
      await this.saveTicketOffline(ticket)
      return ticket
    }
  }

  async updateTicket(id, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/tickets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      return await response.json()
    } catch (error) {
      console.error('Error updating ticket:', error)
      return updates
    }
  }

  // Sincronización
  async sync(changes = []) {
    try {
      const response = await fetch(`${this.baseUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastSync: this.lastSync,
          deviceId: this.deviceId,
          changes,
        }),
      })
      const result = await response.json()
      this.lastSync = new Date(result.currentTime).getTime()
      return result.changes || []
    } catch (error) {
      console.error('Error syncing:', error)
      return []
    }
  }

  // Almacenamiento local (fallback)
  getLocalConfig() {
    const data = localStorage.getItem('sirio_cfg')
    return data ? JSON.parse(data) : {}
  }

  getLocalCategorias() {
    const data = localStorage.getItem('sirio_cats')
    return data ? JSON.parse(data) : []
  }

  getLocalProductos() {
    const data = localStorage.getItem('sirio_prods')
    return data ? JSON.parse(data) : []
  }

  getLocalMesas() {
    const data = localStorage.getItem('sirio_mesas')
    return data ? JSON.parse(data) : []
  }

  async saveTicketOffline(ticket) {
    const db = await this.openIndexedDB()
    const tx = db.transaction('offline_tickets', 'readwrite')
    tx.objectStore('offline_tickets').add(ticket)
  }

  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SirioTPV', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('offline_tickets')) {
          db.createObjectStore('offline_tickets', { autoIncrement: true })
        }
      }
    })
  }

  // Sincronización periódica
  startAutoSync() {
    setInterval(() => {
      this.sync()
    }, this.syncInterval)
  }
}

// Instancia global
window.sirioAPI = new SirioAPIClient()
window.sirioAPI.startAutoSync()
