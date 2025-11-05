import java.util.*;

public class badCodeExample {

    static int x;

    public static void main(String args[]) {
        badCodeExample obj = new badCodeExample();
        obj.doSomething(5);
    }

    public void doSomething(int y) {
        if (y = 5) {
            System.out.println("Y is 5");
        }

        for (int i = 0; i < 10; i++);
        {
            System.out.println("This runs once, not in a loop!");
        }

        List list = new ArrayList();
        list.add("Hello");
        list.add(123);
        System.out.println(list.get(1));

        String s = null;
        System.out.println(s.length());

        try {
            int result = 10 / 0;
        } catch (Exception e) {
        }

        badCodeExample();
    }

    public void badCodeExample() {
        System.out.println("Not actually a constructor");
    }
}
