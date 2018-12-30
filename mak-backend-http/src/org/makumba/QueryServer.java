/*
 * Created on Nov 30, 2013
 *
 * TODO To change the template for this generated file go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
package org.makumba;

public interface QueryServer {

    public QueryResponse execute(QueryRequest req, boolean onlyAnalysis, Attributes attr);

    public void invokeLogic(String op, Pointer p, Object data);

    public void update(Pointer object, String path, Object value);
}
