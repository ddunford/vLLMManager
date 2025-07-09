class Sse {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.init();
  }

  init() {
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache');
    this.res.setHeader('Connection', 'keep-alive');
    this.res.flushHeaders();
  }

  send(data, event) {
    let payload = `data: ${JSON.stringify(data)}\n\n`;
    if (event) {
      payload = `event: ${event}\n${payload}`;
    }
    this.res.write(payload);
  }

  close() {
    this.res.end();
  }
}

module.exports = Sse; 