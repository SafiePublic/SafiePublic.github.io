class MoviePlayer {
  impl = null;

  constructor(container) {
    this.impl = new MoviePlayerImpl(container);
  }

  async load(file) {
    await this.impl.load(file);
  }

  async setSrc(src) {
    await this.impl.setSrc(src);
  }
}