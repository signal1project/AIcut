import { logger } from '../global/log';

export class App {
  constructor() {
    this._init();
  }

  async _init() {
    logger.log('[AICut] app initialized');
  }
}

export default App;
