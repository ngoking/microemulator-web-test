import javax.microedition.midlet.MIDlet;
import javax.microedition.lcdui.*;
import javax.microedition.io.*;

public class ProbeMidlet extends MIDlet implements CommandListener {
    private final Form form = new Form("MicroEmulator browser test");
    private final StringItem result = new StringItem("Runtime", "Java ME is running");
    private final TextField input = new TextField("Test email", "", 80, TextField.EMAILADDR);
    private final Command check = new Command("Check text", Command.OK, 1);
    private final Command network = new Command("Test VT15", Command.SCREEN, 2);
    public void startApp() {
        form.append(result); form.append(input);
        form.addCommand(check); form.addCommand(network); form.setCommandListener(this);
        Display.getDisplay(this).setCurrent(form);
    }
    public void commandAction(Command command, Displayable view) {
        if (command == check) result.setText("test.user@example.com".equals(input.getString()) ? "TEXT INPUT PASS" : "Type test.user@example.com");
        if (command == network) {
            result.setText("Connecting to Universe 15...");
            new Thread(new Runnable() { public void run() {
                try {
                    Connection connection=Connector.open("socket://dragon15.teamobi.com:14445");
                    connection.close(); result.setText("UNIVERSE 15 TCP PASS");
                } catch (Exception e) { result.setText("Network: " + e.toString()); }
            }}).start();
        }
    }
    public void pauseApp() {}
    public void destroyApp(boolean unconditional) {}
}
