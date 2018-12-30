/*
 * Created on Nov 30, 2013
 *
 * TODO To change the template for this generated file go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
package org.makumba.backend;

import java.util.ArrayList;
import java.util.Date;
import java.util.Dictionary;
import java.util.HashMap;
import java.util.Hashtable;
import java.util.List;
import java.util.Map;

import org.makumba.Attributes;
import org.makumba.DataDefinition;
import org.makumba.FieldDefinition;
import org.makumba.Pointer;
import org.makumba.QueryRequest;
import org.makumba.QueryRequest.RelatedQueryData;
import org.makumba.QueryResponse;
import org.makumba.QueryResponse.QueryResult;
import org.makumba.QueryServer;
import org.makumba.Transaction;
import org.makumba.UnauthorizedException;
import org.makumba.list.engine.ComposedQuery;
import org.makumba.list.engine.ComposedQuery.Evaluator;
import org.makumba.list.engine.ComposedSubquery;
import org.makumba.list.engine.Grouper;
import org.makumba.providers.Configuration;
import org.makumba.providers.QueryProvider;
import org.makumba.providers.TransactionProvider;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

public class MakumbaQueryServer implements QueryServer {

    public QueryResponse execute(QueryRequest req, boolean onlyAnalyze, Attributes attr) {
        // System.out.println((onlyAnalyze ? "ana" : "exe") + req);
        List<ComposedQuery> cq = new ArrayList<ComposedQuery>();
        for (RelatedQueryData qd : req.getQueries()) {
            if (qd.parentIndex == -1) {
                // no parent, we are root
                cq.add(new ComposedQuery(qd.querySections, getQueryLanguage(), true));
            } else {
                cq.add(new ComposedSubquery(qd.querySections, cq.get(qd.parentIndex), getQueryLanguage(), true));
            }
            cq.get(cq.size() - 1).init();
        }

        List<Map<String, Integer>> indexes = new ArrayList<Map<String, Integer>>();

        for (int i = 0; i < req.getQueries().size(); i++) {
            // cq.get(i).init();
            Map<String, Integer> ind = new HashMap<String, Integer>();
            indexes.add(ind);
            for (String expr : req.getQueries().get(i).projections) {
                cq.get(i).checkProjectionInteger(expr);
            }
            cq.get(i).analyze();
            for (String s : cq.get(i).getProjections()) {
                ind.put(s, cq.get(i).getProjectionIndex(s));
            }

        }

        QueryResponse qr = new QueryResponse();

        String[][] types = new String[req.getQueries().size()][];
        for (int i = 0; i < req.getQueries().size(); i++) {
            DataDefinition dd = cq.get(i).getResultType();
            List<FieldDefinition> fieldDefinitions = dd.getFieldDefinitions();
            types[i] = new String[fieldDefinitions.size()];
            for (int j = 0; j < types[i].length; j++) {
                types[i][j] = fieldDefinitions.get(j).getJavaType().getName();
                if (types[i][j].equals("org.makumba.Pointer")) {
                    types[i][j] = "ptr " + fieldDefinitions.get(j).getPointedType().getName();
                }
            }
            qr.results.add(new QueryResult(null, indexes.get(i), types[i]));
        }

        if (onlyAnalyze) {
            return qr;
        }

        IterationData[] ids = new IterationData[req.getQueries().size()];

        // QueryProvider qep = getQueryExecutionProvider();

        QueryProvider qep = QueryProvider.makeQueryRunner(Configuration.getDefaultDataSourceName(), "oql", attr);
        try {
            for (int i = 0; i < req.getQueries().size(); i++) {
                IterationData pid = null;
                RelatedQueryData qd = req.getQueries().get(i);
                if (qd.parentIndex >= 0) {
                    pid = ids[qd.parentIndex];
                }
                try {
                    Grouper g = cq.get(i).execute(qep, null, getEvaluator(), req.getQueries().get(i).offset,
                        req.getQueries().get(i).limit);
                    ids[i] = new IterationData(pid, g, types[i], indexes.get(i));
                } catch (UnauthorizedException e) {
                    // TODO: maybe in this case all results should be removed.
                    qr.results.add(new QueryResult(e.getMessage(), e.getClass().getName()));
                }
            }
        } finally {
            qep.close();
        }

        JsonObject result = new JsonObject();

        for (int j = 0; j < req.getQueries().size(); j++) {
            RelatedQueryData qd = req.getQueries().get(j);
            if (qd.parentIndex < 0) {
                result.add(j + "", iterateData(j, ids, req, qr));
            }
        }

        qr.resultData = result;
        return qr;
    }

    public JsonArray iterateData(int index, IterationData[] ids, QueryRequest request, QueryResponse response) {
        // long l = new java.util.Date().getTime();
        IterationData iterationData = ids[index];

        JsonArray result = new JsonArray();

        // the usual iterationData loop
        if (iterationData.startIteration()) {
            for (int i = 0; i < iterationData.iterationSize(); i++) {
                iterationData.setRowIndex(i);

                JsonObject o = new JsonObject();

                for (String projection : response.results.get(index).columnName) {
                    Object obj = iterationData.getExpressionValue(projection);
                    if (obj == null)
                        continue;
                    Class<?> expressionType = iterationData.getExpressionType(projection);
                    if (expressionType == Pointer.class) {
                        o.addProperty(projection,
                            ((Pointer) iterationData.getExpressionValue(projection)).toExternalForm());
                    } else if (Date.class.isAssignableFrom(expressionType)) {
                        o.addProperty(projection, ((Date) obj).getTime());
                    } else {
                        o.addProperty(projection, obj.toString());
                    }
                }

                for (int j = 0; j < request.getQueries().size(); j++) {
                    RelatedQueryData qd = request.getQueries().get(j);
                    if (qd.parentIndex == index) {
                        JsonArray subresults = iterateData(j, ids, request, response);
                        o.add(j + "", subresults);
                    }
                }

                result.add(o);
            }
            /*
             * long end = new java.util.Date().getTime();
             * System.out.println("generating: " + (end - l) + " " +
             * request.getQueries().get(index).getLocalQuery() + " => " +
             * result);
             */

            // end of iteration
            iterationData.closeIteration();
        }

        return result;
    }

    static public String getQueryLanguage() {
        return "oql";
    }

    static public QueryProvider getQueryExecutionProvider() {
        return QueryProvider.makeQueryRunner(TransactionProvider.getInstance().getDefaultDataSourceName(),
            getQueryLanguage(), null);
    }

    public Evaluator getEvaluator() {
        return new ComposedQuery.Evaluator() {
            @Override
            public String evaluate(String s) {
                // TODO, integrate some EL
                return s;
            }
        };
    }

    Class<?> bl;
    {
        try {
            bl = Class.forName(Configuration.getLogicPackages().get("default") + ".Logic");
        } catch (Exception e) {
        }
    }

    public int update(String from, String set, String where, Object param) {
        Transaction tr = TransactionProvider.getInstance().getConnectionToDefault();
        try {
            return tr.update(from, set, where, param);
        } finally {

            tr.close();
        }
    }

    public void update(Pointer object, String path, Object value) {
        Transaction tr = TransactionProvider.getInstance().getConnectionToDefault();
        Dictionary<String, Object> fieldsToChange = new Hashtable<String, Object>();
        fieldsToChange.put(path, value);
        if (bl != null) {
            try {
                bl.getMethod("on_edit_" + object.getType().replace(".", "_"), Transaction.class, Pointer.class,
                    Dictionary.class).invoke(null, tr, object, fieldsToChange);
            } catch (Exception e) {
            }
        }
        tr.update(object, fieldsToChange);
        if (bl != null) {
            try {
                bl.getMethod("after_edit_" + object.getType().replace(".", "_"), Transaction.class, Pointer.class,
                    Dictionary.class).invoke(null, tr, object, fieldsToChange);
            } catch (Exception e) {
            }
        }
        tr.close();
    }

    public void invokeLogic(String op, Pointer p, Object data) {
        Transaction tr = TransactionProvider.getInstance().getConnectionToDefault();
        if (bl != null) {
            try {
                bl.getMethod(op, Transaction.class, Pointer.class, Object.class).invoke(null, tr, p, data);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        tr.close();
    }
}
