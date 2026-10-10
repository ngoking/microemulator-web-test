package org.microemu.device;

import org.microemu.device.j2se.J2SEInputMethod;

// Same package as InputMethod to inspect editor focus without replacing the
// emulator's original input implementation or using reflective access.
public final class BrowserTextInput {
    public static boolean insert(String text) {
        InputMethod input = DeviceFactory.getDevice().getInputMethod();
        if (input.inputMethodListener == null) return false;
        ((J2SEInputMethod)input).clipboardPaste(text);
        return true;
    }
}
