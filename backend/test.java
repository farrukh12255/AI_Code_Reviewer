// Example of BAD Java code — do NOT copy this style!
import java.util.*; import java.io.*; // unnecessary imports

class badCode{
public static void main(String args[]){
Scanner s=new Scanner(System.in);
System.out.println("Enter number");
int x = s.nextInt();
if(x=5){ // <- assignment instead of comparison (doesn't compile!)
System.out.println("x is 5");
}else
System.out.println("x isnt 5");
for(int i=0;i<10;i++)
System.out.println("Counting: "+i); System.out.println("Done!"); // confusing loop
try{
int[] arr=new int[2];
arr[10]=5; // out of bounds
}catch(Exception e){System.out.println("Something bad happened lol");}
badCode b=new badCode();
b.badMethod(); // infinite recursion ahead!
}
void badMethod(){
badMethod(); // infinite recursion - will crash
}
}
