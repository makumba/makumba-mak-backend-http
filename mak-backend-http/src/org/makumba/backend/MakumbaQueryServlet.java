package org.makumba.backend;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.lang.reflect.Type;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.makumba.LogicException;
import org.makumba.QueryRequest;
import org.makumba.QueryRequest.QueryData;
import org.makumba.QueryRequest.RelatedQueryData;
import org.makumba.QueryResponse;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.reflect.TypeToken;

/**
 * Servlet implementation class MakumbaQueryServlet
 */
public class MakumbaQueryServlet extends HttpServlet {
    private static final long serialVersionUID = 1L;

    /**
     * @see HttpServlet#HttpServlet()
     */
    public MakumbaQueryServlet() {
        super();
        // TODO Auto-generated constructor stub
    }

    /**
     * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse response)
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        // TODO Auto-generated method stub
        doPost(request, response);

    }

    static Type typeToken = new TypeToken<Map<String, Object>>() {
    }.getType();

    /**
     * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse response)
     */
    @Override
    protected void doPost(final HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        Gson gson = new Gson();

        InputStream is = request.getInputStream();
        ByteArrayOutputStream os = new ByteArrayOutputStream();
        byte[] buf = new byte[1024];
        int r = 0;
        while (r >= 0) {
            r = is.read(buf);
            if (r >= 0)
                os.write(buf, 0, r);
        }
        String s = new String(os.toByteArray(), "UTF-8");

        try {
            Map<String, String> map = makeQueryMap(s);
            if (map.get("updateFrom") != null) {
                Map<String, Object> params = gson.fromJson(map.get("param"), typeToken);

                for (String k : params.keySet()) {
                    Object v = params.get(k);
                    if (v instanceof Double && (Double) v == ((Double) v).intValue()) {
                        params.put(k, ((Double) v).intValue());
                    }
                }
                response.getWriter().print(new MakumbaQueryServer().update(map.get("updateFrom"), map.get("updateSet"),
                    map.get("updateWhere"), params));
                return;

            } else if (map.get("object") != null) {
                Object value = map.get("value");
                if (map.get("exprType").equals("java.lang.Integer"))
                    value = Integer.parseInt((String) value);

                new MakumbaQueryServer().update(new org.makumba.Pointer(map.get("type"), map.get("object")),
                    map.get("path"), value);
                return;
            }
            response.setContentType("application/json; charset=UTF-8");

            // String decoded = URLDecoder.decode(s, "UTF-8");

            QueryRequest req = null;

            boolean analyzeOnly = "true".equals(map.get("analyzeOnly"));
            boolean filipStyle = map.get("queries") != null;
            if (filipStyle)
                req = readFilipRequest(map);
            else
                req = new Gson().fromJson(map.get("request"), QueryRequest.class);

            QueryResponse resp = new MakumbaQueryServer().execute(req, analyzeOnly, new org.makumba.Attributes() {

                @Override
                public Object getAttribute(String name) throws LogicException {
                    return request.getAttribute(name);
                }

                @Override
                public Object setAttribute(String name, Object value) throws LogicException {
                    return null;
                }

                @Override
                public void removeAttribute(String name) throws LogicException {
                }

                @Override
                public boolean hasAttribute(String name) {
                    return request.getParameter(name) != null;
                }

            });

            String result = filipStyle ? resp.resultData.toString() : new Gson().toJson(resp);

            // System.out.println("Result: " + result);
            response.getWriter().print(result);
        } catch (Throwable e) {
            e.printStackTrace();
            JsonObject error = new JsonObject();
            error.addProperty("error", e.getMessage());
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.getWriter().print(error);
        } finally {

            response.getWriter().close();
        }
    }

    public QueryRequest readFilipRequest(Map<String, String> map) {
        QueryRequest req = new QueryRequest();
        System.out.println("Queries: " + map.get("queries"));

        // Gson gson = new Gson();
        JsonParser parser = new JsonParser();
        JsonArray queries = parser.parse(map.get("queries")).getAsJsonArray();

        for (JsonElement e : queries) {
            RelatedQueryData qd = new RelatedQueryData(e.getAsJsonObject().get("parentIndex").getAsInt(), new QueryData(
                    new String[] { e.getAsJsonObject().get("from").getAsString(), null, null, null, null, null }, 0,
                    -1));
            for (JsonElement sq : e.getAsJsonObject().get("projections").getAsJsonArray()) {
                qd.projections.add(sq.getAsString());
            }
            req.addQuery(qd);
        }
        return req;
    }

    // Based on code from:
    // http://www.coderanch.com/t/383310/java/java/parse-url-query-string-parameter
    private static Map<String, String> makeQueryMap(String query) throws UnsupportedEncodingException {
        String[] params = query.split("&");
        Map<String, String> map = new HashMap<String, String>();
        for (String param : params) {
            int eq = param.indexOf('=');
            map.put(URLDecoder.decode(param.substring(0, eq), "UTF-8"),
                URLDecoder.decode(param.substring(eq + 1), "UTF-8"));
        }
        return map;
    }

}
