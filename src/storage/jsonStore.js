import fs from 'fs';
import path from 'path';

/**
 * Gestionnaire générique de stockage JSON local (Zéro BDD).
 * Fournit des opérations atomiques et une sérialisation des écritures via mutex mémoire (Queue FIFO).
 */
export class JsonStore {
  /**
   * @param {string} filePath - Chemin absolu ou relatif vers le fichier .json
   * @param {*} defaultData - Données initiales si le fichier n'existe pas
   */
  constructor(filePath, defaultData = {}) {
    this.filePath = path.resolve(filePath);
    this.defaultData = defaultData;
    this.queue = Promise.resolve();
    this.initialized = false;
  }

  /**
   * Assure l'existence du dossier parent et du fichier JSON.
   */
  async init() {
    if (this.initialized) return;

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      await this.writeRaw(this.defaultData);
    }

    this.initialized = true;
  }

  /**
   * Lecture du fichier JSON.
   * @returns {Promise<any>}
   */
  async read() {
    await this.init();
    try {
      const content = await fs.promises.readFile(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return structuredClone(this.defaultData);
      }
      throw error;
    }
  }

  /**
   * Écriture atomique avec file d'attente (Mutex) pour empêcher les corruptions concurrentes.
   * @param {any} data
   * @returns {Promise<void>}
   */
  async write(data) {
    await this.init();
    // Enchaînement dans la queue FIFO pour garantir la séquence
    this.queue = this.queue.then(() => this.writeRaw(data)).catch((err) => {
      // Préserve la chaîne même en cas d'erreur
      throw err;
    });
    return this.queue;
  }

  /**
   * Met à jour les données de manière transactionnelle.
   * @param {(currentData: any) => any | Promise<any>} updater
   * @returns {Promise<any>}
   */
  async update(updater) {
    await this.init();
    let result;
    this.queue = this.queue.then(async () => {
      const current = await this.read();
      const updated = await updater(current);
      await this.writeRaw(updated);
      result = updated;
    });
    await this.queue;
    return result;
  }

  /**
   * Écriture atomique physique : écriture vers un fichier temporaire puis renommage atomique.
   * @private
   */
  async writeRaw(data) {
    const tempPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const serialized = JSON.stringify(data, null, 2);

    try {
      await fs.promises.writeFile(tempPath, serialized, 'utf-8');
      // Sur Windows fs.promises.rename remplace atomiquement le fichier
      await fs.promises.rename(tempPath, this.filePath);
    } catch (err) {
      // Nettoyage en cas d'échec
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      } catch {
        // Ignorer l'erreur de nettoyage
      }
      throw err;
    }
  }
}
