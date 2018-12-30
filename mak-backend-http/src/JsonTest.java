
import org.makumba.QueryRequest;
import org.makumba.QueryRequest.QueryData;
import org.makumba.QueryRequest.RelatedQueryData;
import org.makumba.backend.MakumbaQueryServer;

public class JsonTest {

    public static void main(String[] args) {
        QueryRequest req = new QueryRequest();

        RelatedQueryData qd = new RelatedQueryData(-1, new QueryData(new String[] { "peer.Session s", null, null, null,
                null, null }, 0, -1));
        qd.projections.add("s.name");

        int parentIndex = req.addQuery(qd);

        RelatedQueryData sqd = new RelatedQueryData(parentIndex, new QueryData(new String[] { "s.question q", null,
                null, null, null, null }, 0, -1));
        sqd.projections.add("q.nr");

        req.addQuery(sqd);

        System.out.println(new MakumbaQueryServer().execute(req, false, null).resultData);

    }
}
