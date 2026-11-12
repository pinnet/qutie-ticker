// Ways of getting bytes to the printer.

export interface Transport {
  write(bytes: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

/**
 * Bluetooth classic SPP via a bound RFCOMM device (`rfcomm bind 0 <MAC> 1`
 * gives /dev/rfcomm0). The kernel opens the link on first write.
 */
export class RfcommTransport implements Transport {
  private file?: Deno.FsFile;
  private path: string;
  private chunk: number;
  constructor(path = "/dev/rfcomm0", chunk = 512) {
    this.path = path;
    this.chunk = chunk;
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.file ??= await Deno.open(this.path, { read: true, write: true });
    for (let o = 0; o < bytes.length; o += this.chunk) {
      const part = bytes.subarray(o, o + this.chunk);
      let n = 0;
      while (n < part.length) n += await this.file.write(part.subarray(n));
    }
  }

  /** Reads one reply (e.g. after cmd.status()); resolves null on timeout. */
  async read(max = 256, timeoutMs = 1000): Promise<Uint8Array | null> {
    if (!this.file) return null;
    const buf = new Uint8Array(max);
    const timer = new Promise<null>((r) => setTimeout(() => r(null), timeoutMs));
    const n = await Promise.race([this.file.read(buf), timer]);
    return n ? buf.subarray(0, n) : null;
  }

  close(): Promise<void> {
    this.file?.close();
    this.file = undefined;
    return Promise.resolve();
  }
}

/** Writes the job to a file instead of printing. For dry runs and captures. */
export class FileTransport implements Transport {
  private path: string;
  private parts: Uint8Array[] = [];
  constructor(path: string) {
    this.path = path;
  }
  write(bytes: Uint8Array): Promise<void> {
    this.parts.push(bytes.slice());
    return Promise.resolve();
  }
  async close(): Promise<void> {
    const total = this.parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    await Deno.writeFile(this.path, out);
  }
}
