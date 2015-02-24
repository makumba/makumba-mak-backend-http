/*
 * Created on Nov 30, 2013
 *
 * TODO To change the template for this generated file go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
package org.makumba;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.makumba.list.engine.Grouper;

import com.google.gson.JsonObject;

/**
 * A multiple query response. Queries from the same hierarchy are sent all at once and their results are returned all at
 * once. QueryResponse objects are meant to be transferred between frontend and backend by e.g. json.
 * 
 * @author cristi
 */
public final class QueryResponse {
    static public class QueryResult {
        public final String errorMessage;

        public final String errorClass;

        public final String[] columnType;

        public final Map<String, Integer> columnIndex;

        public final String[] columnName;

        public QueryResult(Grouper result, Map<String, Integer> columnIndex, String[] columnType) {
            this.errorMessage = null;
            this.errorClass = null;
            this.columnIndex = columnIndex;
            this.columnType = columnType;
            columnName = new String[columnType.length];
            for (Entry<String, Integer> e : columnIndex.entrySet()) {
                columnName[e.getValue()] = e.getKey();
            }

        }

        public QueryResult(String errorMessage, String errorClass) {
            this.errorMessage = errorMessage;
            this.errorClass = errorClass;
            columnType = null;
            columnIndex = null;
            columnName = null;
        }
    }

    public final List<QueryResult> results;

    public JsonObject resultData;

    public QueryResponse() {
        this.results = new ArrayList<QueryResult>();
    }
}
