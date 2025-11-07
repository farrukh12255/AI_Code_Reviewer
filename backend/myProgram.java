import com.galaxefi.base.CommonTestFunctions;
import org.openqa.selenium.By;
import org.openqa.selenium.support.ui.ExpectedConditions;

public class Booking_InTransit extends CommonTestFunctions {
    By bookingInTransit_standardFlowPendingBtn = By.cssSelector("button.ant-btn.intransit-step-button.sf-button.rounded.pending");
    By bookingInTransit_standardFlowInProgressBtn = By.cssSelector("button.ant-btn.intransit-step-button.sf-button.rounded.in_progress");
    By bookingInTransit_navigateToInTrasitBtn = By.cssSelector("div.ant-col.d-flex.justify-content-end.ant-col-xs-5.ant-col-md-2 > span > svg > path");
    By bookingInTransit_navigateToPODBtn = By.cssSelector("div.ant-col.d-flex.justify-content-end.ant-col-xs-1.ant-col-md-1 > span > svg > path");
    public void navigateToInTransit(){
        wait.until(ExpectedConditions.visibilityOfElementLocated(bookingInTransit_navigateToInTrasitBtn));
        wait.until(ExpectedConditions.elementToBeClickable(bookingInTransit_navigateToInTrasitBtn));
        driver.findElement(bookingInTransit_navigateToInTrasitBtn).click();
    }
    public void navigateToPOD(){
        wait.until(ExpectedConditions.visibilityOfElementLocated(bookingInTransit_navigateToPODBtn));
        wait.until(ExpectedConditions.elementToBeClickable(bookingInTransit_navigateToPODBtn));
        driver.findElement(bookingInTransit_navigateToPODBtn).click();
    }
    public void verifyInTransitCompleted(){
        wait.until(ExpectedConditions.visibilityOfElementLocated(bookingInTransit_standardFlowInProgressBtn));
        wait.until(ExpectedConditions.elementToBeClickable(bookingInTransit_standardFlowInProgressBtn));
    }
    public void navigateToCompleteInTransitProcess(){
        wait.until(ExpectedConditions.visibilityOfElementLocated(bookingInTransit_standardFlowPendingBtn));
        wait.until(ExpectedConditions.elementToBeClickable(bookingInTransit_standardFlowPendingBtn));
        driver.findElement(bookingInTransit_standardFlowPendingBtn).click();
    }
    public void tapToConfirmThisStepButton(Boolean POL, Boolean inTransit, Boolean POD){
        int i,j = 0;
        if(POL && !inTransit && !POD){
            j =6;
        }
        else if(!POL && inTransit && !POD){
            j =2;
        }
        else if(!POL && !inTransit && POD){
            j =4;
        }
        for (i=1;i<=j;i++){
            By bookingInTransit_tapToConfirmBtn = By.cssSelector("div:nth-child("+i+") > div > div.ant-steps-item-content > div.ant-steps-item-description > div > button");
            wait.until(ExpectedConditions.visibilityOfElementLocated(bookingInTransit_tapToConfirmBtn));
            wait.until(ExpectedConditions.elementToBeClickable(bookingInTransit_tapToConfirmBtn));
            driver.findElement(bookingInTransit_tapToConfirmBtn).click();
            wait.until(ExpectedConditions.invisibilityOfElementLocated(bookingInTransit_tapToConfirmBtn));
        }
    }
}
 