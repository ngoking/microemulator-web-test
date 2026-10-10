package local.microemu;

import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Container;
import java.awt.EventQueue;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.Arrays;
import javax.swing.UIManager;
import org.microemu.app.Main;
import org.microemu.app.ui.swing.SwingDeviceComponent;
import org.microemu.device.j2se.J2SEDevice;
import org.microemu.device.j2se.J2SEInputMethod;
import org.microemu.device.DeviceFactory;

public final class BrowserMain extends Main {
    private static final long serialVersionUID = 1L;
    private static BrowserMain instance;
    private SwingDeviceComponent screen;

    public static void launch(String jarPath) throws Exception {
        UIManager.setLookAndFeel(UIManager.getCrossPlatformLookAndFeelClassName());
        final BrowserMain app = new BrowserMain();
        instance = app;
        app.setUndecorated(true);
        app.setJMenuBar(null);
        Container content = app.getContentPane();
        Component south = ((BorderLayout)content.getLayout()).getLayoutComponent(BorderLayout.SOUTH);
        if (south != null) content.remove(south);
        app.common.initParams(new ArrayList<String>(Arrays.asList(
            "--resizableDevice", "240", "320", "--rms", "file", jarPath
        )), app.selectDevicePanel.getSelectedDeviceEntry(), J2SEDevice.class);
        app.updateDevice();
        app.screen = findScreen(content);
        app.setLocation(0, 0);
        app.setVisible(true);
        app.common.initMIDlet(true);
        if (app.screen != null) app.screen.requestFocusInWindow();
    }

    private static SwingDeviceComponent findScreen(Container parent) {
        for (Component c : parent.getComponents()) {
            if (c instanceof SwingDeviceComponent) return (SwingDeviceComponent)c;
            if (c instanceof Container) {
                SwingDeviceComponent found = findScreen((Container)c);
                if (found != null) return found;
            }
        }
        return null;
    }

    public static void key(final int code, final int character, final boolean down) {
        if (instance == null || instance.screen == null) return;
        EventQueue.invokeLater(new Runnable() { public void run() {
            SwingDeviceComponent screen = instance.screen;
            KeyEvent event = new KeyEvent(screen, down ? KeyEvent.KEY_PRESSED : KeyEvent.KEY_RELEASED,
                System.currentTimeMillis(), 0, code, (char)character);
            if (down) screen.keyPressed(event); else screen.keyReleased(event);
        }});
    }

    // Inserts only into the current Java ME text editor. It does not submit a form.
    public static void paste(final String text) {
        EventQueue.invokeLater(new Runnable() { public void run() {
            ((J2SEInputMethod)DeviceFactory.getDevice().getInputMethod()).clipboardPaste(text);
        }});
    }
}
