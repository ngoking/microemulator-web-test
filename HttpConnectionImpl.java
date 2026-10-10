package javax.microedition.io;

import java.io.*;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import pl.zb3.freej2me.bridge.network.NetworkBridge;

public final class HttpConnectionImpl implements HttpConnection {
    private final String url;
    private final URI uri;
    private String method = GET;
    private final LinkedHashMap<String,String> headers = new LinkedHashMap<String,String>();
    private final ByteArrayOutputStream output = new ByteArrayOutputStream();
    private Object response;
    private boolean closed;
    public HttpConnectionImpl(String url) throws IOException {
        this.url=url;
        try { uri=new URI(url); if(uri.getHost()==null) throw new IOException("Invalid HTTP address"); }
        catch(java.net.URISyntaxException e) { throw new IOException(e); }
    }
    private Object response() {
        if (response == null && !closed) {
            String[] pairs = new String[headers.size()*2]; int i=0;
            for(Map.Entry<String,String> item:headers.entrySet()) { pairs[i++]=item.getKey(); pairs[i++]=item.getValue(); }
            response=NetworkBridge.request(url,method,pairs,output.toByteArray());
        }
        return response;
    }
    public InputStream openInputStream() throws IOException {
        if(closed) throw new IOException("HTTP connection is closed");
        Object r=response(); if(r==null || NetworkBridge.status(r)==0) throw new IOException(r==null?"HTTP request failed":NetworkBridge.error(r));
        return new ByteArrayInputStream(NetworkBridge.body(r));
    }
    public OutputStream openOutputStream() throws IOException {
        if(closed || response!=null) throw new IOException("HTTP request already sent");
        return output;
    }
    public DataInputStream openDataInputStream() throws IOException { return new DataInputStream(openInputStream()); }
    public DataOutputStream openDataOutputStream() throws IOException { return new DataOutputStream(openOutputStream()); }
    public void close() { closed=true; }
    public String getURL() { return url; }
    public String getHost() { return uri.getHost(); }
    public int getPort() { return uri.getPort()==-1 ? ("https".equals(uri.getScheme())?443:80) : uri.getPort(); }
    public String getProtocol() { return uri.getScheme(); }
    public String getFile() { return uri.getRawPath(); }
    public String getQuery() { return uri.getRawQuery(); }
    public String getRef() { return uri.getRawFragment(); }
    public String getRequestMethod() { return method; }
    public void setRequestMethod(String method) { if(response!=null) throw new IllegalStateException(); this.method=method; }
    public String getRequestProperty(String key) { return headers.get(key); }
    public void setRequestProperty(String key,String value) { if(response!=null) throw new IllegalStateException(); headers.put(key,value); }
    public int getResponseCode() { Object r=response(); return r==null ? 0 : NetworkBridge.status(r); }
    public String getResponseMessage() { return String.valueOf(getResponseCode()); }
    public String getHeaderField(String name) { Object r=response(); return r==null ? null : NetworkBridge.header(r,name); }
    public String getHeaderField(int index) { String name=getHeaderFieldKey(index); return name==null ? null : getHeaderField(name); }
    public String getHeaderFieldKey(int index) { Object r=response(); return r==null ? null : NetworkBridge.headerName(r,index); }
    public int getHeaderFieldInt(String name,int fallback) { try { return Integer.parseInt(getHeaderField(name)); } catch(Exception e) { return fallback; } }
    public long getHeaderFieldDate(String name,long fallback) { try { return java.time.ZonedDateTime.parse(getHeaderField(name),java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli(); } catch(Exception e) { return fallback; } }
    public long getDate() { return getHeaderFieldDate("date",0); }
    public long getExpiration() { return getHeaderFieldDate("expires",0); }
    public long getLastModified() { return getHeaderFieldDate("last-modified",0); }
    public long getLength() { try { return Long.parseLong(getHeaderField("content-length")); } catch(Exception e) { return -1; } }
    public String getType() { return getHeaderField("content-type"); }
    public String getEncoding() { return getHeaderField("content-encoding"); }
}
