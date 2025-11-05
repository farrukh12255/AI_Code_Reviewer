import java.util.Scanner;

public class worseCodeExample {

    static Scanner input = new Scanner(System.in);
    static int number = 0;

    public static void main(String[] args) {
        worseCodeExample example = new worseCodeExample();
        example.main(null); // recursive main call – infinite recursion
    }

    public void start() {
        System.out.println("Enter a number");
        number = input.nextInt();
        if (number > 10)
            if (number < 5)
                System.out.println("Impossible!"); // unreachable
            else
                System.out.println("Maybe!");
        else
            System.out.println("Okay");

        switch (number) {
            case 1:
                System.out.println("One");
            case 2:
                System.out.println("Two");
            default:
                System.out.println("Nothing"); // no breaks – all cases fall through
        }

        for (int i = 0; i >= 0; i++) { // infinite loop
            if (i == 5)
                i = -1; // never terminates
        }
