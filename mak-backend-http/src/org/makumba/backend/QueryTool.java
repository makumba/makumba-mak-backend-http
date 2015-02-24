package org.makumba.backend;

import java.io.IOException;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.Logger;

import jline.ConsoleReader;

import org.makumba.QueryRequest;
import org.makumba.QueryRequest.RelatedQueryData;
import org.makumba.QueryResponse;
import org.makumba.providers.query.QuerySectionProcessor;

import com.google.gson.Gson;

public class QueryTool {
    public static void main(String argv[]) throws IOException {
        System.setProperty("org.makumba.addToClassPath", System.getProperty("user.dir"));

        MakumbaQueryServer srv = null;

        Logger.getLogger("org.makumba.db.query.execution").setLevel(Level.FINE);
        // Logger.getLogger("org.makumba.db.query.compilation").setLevel(Level.FINE);

        for (Handler h : Logger.getLogger("").getHandlers()) {
            h.setLevel(Level.FINE);
        }

        String line;
        ConsoleReader reader = new ConsoleReader();
        srv = new MakumbaQueryServer();
        srv = null;
        while (true) {
            if (srv == null) {
                try {
                    srv = new MakumbaQueryServer();
                } catch (org.makumba.ConfigurationError ce) {
                    System.err.println("No configuration found in " + System.getProperty("org.makumba.addToClassPath"));
                }
            }
            line = reader.readLine("mql> ");
            if (line == null || "quit".equals(line))
                break;
            if (line.toLowerCase().trim().startsWith("cd ")) {
                String dir = line.substring(line.indexOf(' ')).trim();
                if (dir.startsWith("/"))
                    System.setProperty("org.makumba.addToClassPath", dir);
                else
                    System.setProperty("org.makumba.addToClassPath", System.getProperty("org.makumba.addToClassPath")
                            + "/" + dir);
                System.out.println("Switching config to " + System.getProperty("org.makumba.addToClassPath"));
                srv = null;
                continue;
            }
            if (line.trim().length() == 0)
                continue;

            QuerySectionProcessor qsp = new QuerySectionProcessor(line, 0);
            QueryRequest req = new QueryRequest();

            RelatedQueryData relatedQd = new RelatedQueryData(new String[] { qsp.getFrom(), qsp.getWhere(), null, null,
                    null, null }, 0, -1);

            String proj = qsp.getProjectionText();
            int index = 0;
            int parLevel = 0;
            StringBuffer prm = new StringBuffer();
            while (true) {
                if (index == proj.length() || (parLevel == 0 && proj.charAt(index) == ',')) {
                    relatedQd.projections.add(prm.toString().trim());
                    prm = new StringBuffer();
                    if (index == proj.length())
                        break;
                } else
                    prm.append(proj.charAt(index));

                if (proj.charAt(index) == '(')
                    parLevel++;
                if (proj.charAt(index) == ')')
                    parLevel--;

                index++;
            }
            req.addQuery(relatedQd);
            try {
                QueryResponse results = srv.execute(req, false);
                System.out.println(new Gson().toJson(results.results.get(0).columnType));
                System.out.println(new Gson().toJson(results.resultData.get("0")));
            } catch (Throwable e) {
                if (e.getCause() instanceof org.makumba.OQLParseError) {
                    e = e.getCause();
                    System.err.println(e);
                } else
                    e.printStackTrace();
            }

        }
        System.out.println("\nGoodbye");
    }
}
