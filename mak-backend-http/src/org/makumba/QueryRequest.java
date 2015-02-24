/*
 * Created on Nov 30, 2013
 *
 * TODO To change the template for this generated file go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
package org.makumba;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A multiple query request. Queries from the same hierarchy are sent all at once and their results are returned all at
 * once. Queries are hierarchical: a query can indicate a previously added superquery by its index. QueryRequest objects
 * are meant to be transferred between frontend and backend by e.g. json. TODO: add parameter values
 * 
 * @author cristi
 */
public class QueryRequest {
    public static class QueryData {
        public final Set<String> projections = new HashSet<String>();

        public final String[] querySections;

        public final int offset, limit;

        public QueryData(String[] sections, int offset, int limit) {

            querySections = sections;
            this.offset = offset;
            this.limit = limit;
        }

        @Override
        public String toString() {
            return "SELECT " + projections + " " + getLocalQuery();
        }

        public String getLocalQuery() {
            // constants are spelled out to eliminate frontend dependency on
            // ComposedQuery
            StringBuffer sb = new StringBuffer("FROM ").append(querySections[0]);
            int idx = 1;
            if (querySections[idx] != null)
                sb.append(" WHERE ").append(querySections[idx]);
            idx = 3;
            if (querySections[idx] != null)
                sb.append(" ORDER BY ").append(querySections[idx]);
            idx = 2;
            if (querySections[idx] != null)
                sb.append(" GROUP BY ").append(querySections[idx]);
            return sb.toString();
        }
    }

    public static final class RelatedQueryData extends QueryData {
        public final Integer parentIndex;

        public RelatedQueryData(String[] sections, int offset, int limit) {
            super(sections, offset, limit);
            this.parentIndex = -1;
        }

        public RelatedQueryData(int parentIndex, QueryData cpy) {
            super(cpy.querySections, cpy.offset, cpy.limit);
            this.parentIndex = parentIndex;
        }

        public void addProjection(String expr) {
            projections.add(expr);
        }

        @Override
        public String toString() {
            return "" + parentIndex + ": " + super.toString();
        }
    }

    final List<RelatedQueryData> queries = new ArrayList<RelatedQueryData>();

    public int addQuery(RelatedQueryData qd) {
        if (queries.size() - 1 < qd.parentIndex)
            throw new IllegalArgumentException("parent query does not exist!");
        queries.add(qd);
        return queries.size() - 1;
    }

    public List<RelatedQueryData> getQueries() {
        return queries;
    }

    @Override
    public String toString() {
        return queries.toString();
    }

}
