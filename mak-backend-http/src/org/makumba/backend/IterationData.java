/*
 * Created on Mar 7, 2011
 *
 * TODO To change the template for this generated file go to
 * Window - Preferences - Java - Code Style - Code Templates
 */
package org.makumba.backend;

import java.util.Dictionary;
import java.util.List;
import java.util.Map;
import java.util.Stack;
import java.util.logging.Logger;

import org.makumba.Pointer;
import org.makumba.commons.ArrayMap;
import org.makumba.list.engine.Grouper;

/**
 * A state object meant to be associated with a query node of any interactive component tree. It computes a query
 * (ComposedQuery) based on the query sections of the tree node. At the beginning, the analyzeQuery() method can be
 * called to trigger query analysis. This information can be used for the node retrieving type data which may be needed
 * for rendering. Then, on each iteration of the parent query node (if any) the current query node must iterate through
 * the rows that correspond to the current row of the parent node iteration. The following methods can be called for
 * that: startIeration(), iterationSize(), setRowIndex(), and closeIteration(). This is a template: if
 * (getIterationData.startIteration()) { for (int i = 0; i < iterationData.iterationSize(); i++) {
 * iterationData.setRowIndex(i); for all children in the tree: duplicate child let the child iterate through its own
 * iteration data } iterationData.closeIteration(); } During iteration, getExpressionValue() methods can be used to
 * retrieve the value of the respective query expression in the current row.
 * 
 * @author cristi
 */
public class IterationData {
    static final Logger log = java.util.logging.Logger.getLogger("org.makumba.iteration");

    IterationData parent;

    Grouper listData;

    private final String[] columnType;

    private final Map<String, Integer> columnIndex;

    public IterationData(IterationData parent, Grouper gr, String[] columnType, Map<String, Integer> columnIndex) {

        this.parent = parent;
        this.listData = gr;
        this.columnType = columnType;
        this.columnIndex = columnIndex;

    }

    static final private Dictionary<String, Object> NOTHING = new ArrayMap();

    // current iteration of this list
    transient ArrayMap currentData;

    private static ThreadLocal<Stack<Dictionary<String, Object>>> currentDataStack = new ThreadLocal<Stack<Dictionary<String, Object>>>();

    // transient private DataDefinition projections;

    transient int currentIndex = -1;

    transient List<ArrayMap> iterationGroupData;

    public boolean startIteration() {
        if (parent == null) {
            startMakListGroup();
        }

        if (currentDataStack.get() != null) {
            iterationGroupData = listData != null ? listData.getData(currentDataStack.get()) : null;
        } else {
            iterationGroupData = null;
        }

        if (iterationGroupData == null) {
            return false;
        }
        // parent = MakumbaDataContext.getDataContext().getCurrentList();

        // MakumbaDataContext.getDataContext().setCurrentList(this);

        // push a placeholder, it will be popped at first iteration
        currentDataStack.get().push(NOTHING);
        return true;
    }

    private void startMakListGroup() {
        startIterationGroup();

    }

    private void startIterationGroup() {
        // we are in root, we initialize the data stack
        currentDataStack.set(new Stack<Dictionary<String, Object>>());

        // and we push the key needed for the root mak:list to find its data
        // (see beforeIteration)
        currentDataStack.get().push(NOTHING);
    }

    public Object getExpressionValue(int exprIndex) {
        return currentData.data[exprIndex];
    }

    public int getRowWidth() {
        return columnType.length;
    }

    public Integer getExpressionIndex(String expr) {
        return columnIndex.get(expr);
    }

    public void setRowIndex(int rowIndex) {

        currentIndex = rowIndex;
        // System.out.println(debugIdent() + " " + rowIndex);
        if (inBounds(rowIndex)) {
            // pop old value:
            currentDataStack.get().pop();
            currentData = iterationGroupData.get(rowIndex);
            // push new value:
            currentDataStack.get().push(currentData);
            // System.out.println(debugIdent() + " " + rowIndex + " " +
            // iterationGroupData.size());

            /*
             * for (SetIterationContext<Widget> sc : setComposedSubqueries
             * .values()) { sc.nextParentIteration(); }
             */
        }
    }

    public int iterationSize() {
        if (iterationGroupData == null)
            return 0;
        return iterationGroupData.size();
    }

    public boolean inBounds(int rowIndex) {
        return rowIndex >= 0 && rowIndex < iterationSize();
    }

    public void closeIteration() {

        iterationGroupData = null;

        currentIndex = -1;
        // this list is done, no more current value in stack
        currentDataStack.get().pop();
        // MakumbaDataContext.getDataContext().setCurrentList(parent);
        if (parent == null) {
            endIterationGroup();
        }
    }

    private void endIterationGroup() {

        currentDataStack.get().pop();

        // we are in root, we initialize the data stack
        currentDataStack.set(null);
        // log.fine(debugIdent() + " ----------- end ----------- " + o);
    }

    public Class<?> getExpressionType(String expression) {
        if (expression.equals("null"))
            return Pointer.class;
        String type = columnType[columnIndex.get(expression)];
        return getTypeFromString(type);
    }

    static public Class<?> getTypeFromString(String type) {
        try {
            if (type.startsWith("ptr"))
                return org.makumba.Pointer.class;
            return Class.forName(type);
        } catch (ClassNotFoundException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
            return null;
        }
    }

    public Object getExpressionValue(String expr) {
        if (currentIndex == -1) {
            // we're not iterating, our value is not correct
            return null;
        }
        return getExpressionValue(getExpressionIndex(expr));
    }

    // ////////// end of copied code
}

// transient Map<String, SetIterationContext<Widget>> setComposedSubqueries =
// new HashMap<String, SetIterationContext<Widget>>();
//
// void detectSet(String expr, String label, String fieldPath) {
// // detect sets, make a virtual subquery for them so we can resolve them
// QueryAnalysis qa = getQueryAnalysis();
// FieldDefinition setFd = null;
//
// if (fieldPath != null)
// setFd = qa.getLabelType(label).getFieldOrPointedFieldDefinition(
// fieldPath);
// if (setFd != null && fieldPath != null && !expr.endsWith(".id")
// && setFd.isSetType()) {
// SetIterationContext<Widget> sc = new SetIterationContext<Widget>(
// queryData, eng, expr, setFd);
// setComposedSubqueries.put(expr, sc);
// } else {
// queryData.checkProjectionInteger(expr);
// }
// }
//
// public boolean hasSetProjection(String path) {
// return setComposedSubqueries.get(path) != null;
// }
//
// public DataDefinition getSetProjectionType(String path) {
// return setComposedSubqueries.get(path).getSetElementType();
// }
//
// public SetList<Pointer> getSetData(String path) {
// return setComposedSubqueries.get(path).getSetData();
// }
// private static class SetIterationContext<Widget> implements Serializable {
//
// private static final long serialVersionUID = 1L;
//
// private final ComposedQuery composedQuery;
//
// private Grouper grouper;
//
// private transient SetList<Pointer> setData;
//
// private final String setLabel;
//
// private final String titleProjection;
//
// private final MakumbaContext eng;
//
// public SetIterationContext(ComposedQuery superQuery,
// MakumbaContext eng, String expr, FieldDefinition setFd) {
// // create a new composed query, search for the set member pointer
// // and title
// this.setLabel = getSetLabel(expr);
// String queryProps[] = new String[5];
// // TODO in the JSP ValueComputer there was a JOIN added for HQL, not
// // sure it's needed any longer
// queryProps[ComposedQuery.FROM] = expr + " " + setLabel;
// this.composedQuery = new ComposedSubquery(queryProps, superQuery,
// eng.getQueryLanguage(), true);
// this.composedQuery.init();
// this.composedQuery.checkProjectionInteger(setLabel);
// this.titleProjection = setLabel + "."
// + setFd.getPointedType().getTitleFieldName();
// this.composedQuery.checkProjectionInteger(titleProjection);
// this.composedQuery.analyze();
// this.eng = eng;
// }
//
// private static String getSetLabel(String path) {
// return path.replace('.', '_');
// }
//
// public void execute(QueryProvider qep, int offset, int limit) {
// try {
// this.grouper = composedQuery.execute(qep, null,
// eng.getEvaluator(), offset, limit);
// } catch (UnauthorizedException e) {
// e.printStackTrace();
// }
// }
//
// public void nextParentIteration() {
// List<ArrayMap> data = grouper
// .getData(currentDataStack.get(), false);
// // the set might be empty for the current stack
// if (data == null || data.size() == 0) {
// return;
// }
// assert data != null;
// setData = new SetList<Pointer>();
//
// for (ArrayMap a : data) {
// // save the data to a special list that on toString will print
// // the titles
// this.setData.add((Pointer) a.data[this.composedQuery
// .getProjectionIndex(this.setLabel)]);
// this.setData.getTiteList().add(
// (String) a.data[this.composedQuery
// .getProjectionIndex(this.titleProjection)]);
// }
// }
//
// public DataDefinition getSetElementType() {
// return composedQuery.getFromLabelTypes().get(setLabel);
// }
//
// public SetList<Pointer> getSetData() {
// return setData;
// }
// }
