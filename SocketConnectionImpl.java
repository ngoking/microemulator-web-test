package javax.microedition.io;

import java.io.*;
import java.net.URI;
import java.util.HashMap;
import pl.zb3.freej2me.bridge.network.NetworkBridge;

public final class SocketConnectionImpl implements SocketConnection {
    private final String host;
    private final int port;
    private final Object socket;
    private boolean closed;
    private final HashMap<Byte,Integer> options = new HashMap<Byte,Integer>();
    public SocketConnectionImpl(String name) throws IOException {
        try {
            URI uri = new URI(name);
            host = uri.getHost(); port = uri.getPort();
            if (host == null || port < 1 || port > 65535) throw new IOException("Invalid socket address");
            socket = NetworkBridge.open(host, port, name.startsWith("ssl://"));
            if (socket == null) throw new IOException("Could not open game connection");
            String error = NetworkBridge.error(socket);
            if (error != null) throw new IOException(error);
        } catch (java.net.URISyntaxException ex) { throw new IOException(ex); }
    }
    private void checkOpen() throws IOException { if (closed) throw new IOException("Socket is closed"); }
    private static void checkRange(byte[] b, int off, int len) {
        if (b == null) throw new NullPointerException();
        if (off < 0 || len < 0 || off > b.length - len) throw new IndexOutOfBoundsException();
    }
    public InputStream openInputStream() throws IOException {
        checkOpen();
        return new InputStream() {
            public int read() throws IOException { byte[] b = new byte[1]; return read(b,0,1) < 0 ? -1 : b[0] & 255; }
            public int read(byte[] b,int off,int len) throws IOException {
                checkRange(b,off,len); checkOpen(); if (len == 0) return 0;
                int count = NetworkBridge.read(socket,b,off,len);
                if (count == -2) throw new IOException(NetworkBridge.error(socket));
                return count;
            }
            public int available() throws IOException { checkOpen(); return NetworkBridge.available(socket); }
            public void close() throws IOException { SocketConnectionImpl.this.close(); }
        };
    }
    public OutputStream openOutputStream() throws IOException {
        checkOpen();
        return new OutputStream() {
            public void write(int value) throws IOException { write(new byte[]{(byte)value},0,1); }
            public void write(byte[] b,int off,int len) throws IOException {
                checkRange(b,off,len); checkOpen(); if (len == 0) return;
                if (!NetworkBridge.write(socket,b,off,len)) throw new IOException(NetworkBridge.error(socket));
            }
            public void close() throws IOException { SocketConnectionImpl.this.close(); }
        };
    }
    public DataInputStream openDataInputStream() throws IOException { return new DataInputStream(openInputStream()); }
    public DataOutputStream openDataOutputStream() throws IOException { return new DataOutputStream(openOutputStream()); }
    public void close() { if (!closed) { closed = true; NetworkBridge.close(socket); } }
    public String getAddress() { return host; }
    public String getLocalAddress() { return "127.0.0.1"; }
    public int getPort() { return port; }
    public int getLocalPort() { return 0; }
    public int getSocketOption(byte option) { Integer value=options.get(option); return value == null ? 0 : value; }
    public void setSocketOption(byte option,int value) { options.put(option,value); }
}
