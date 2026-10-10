package pl.zb3.freej2me.bridge.network;

public final class NetworkBridge {
    private NetworkBridge() {}
    public static native Object open(String host, int port, boolean secure);
    public static native int read(Object socket, byte[] bytes, int offset, int length);
    public static native boolean write(Object socket, byte[] bytes, int offset, int length);
    public static native int available(Object socket);
    public static native void close(Object socket);
    public static native String error(Object socket);
    public static native Object request(String url, String method, String[] headers, byte[] body);
    public static native int status(Object response);
    public static native String header(Object response, String name);
    public static native String headerName(Object response, int index);
    public static native byte[] body(Object response);
}
