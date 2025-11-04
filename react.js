import { SIGN_UP_METHODS } from "@sharecode/common/constants/ApiConstant";
import { CUSTOMER } from "@sharecode/common/constants/GeneralConstant";
import { THEME_BLUE } from "@sharecode/common/constants/ThemeConstant";
import customerSignupService from "@sharecode/common/services/SignupServices/GeneralSignUpService";
import { postMethod } from "@sharecode/common/utils/helper.js";
import { Col, Row } from "antd";
import PopupMessage from "components/layout-components/PopupMessage";
import IntlMessage from "components/util-components/IntlMessage";
import { useState, useEffect } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import GeneralRegistration from "../general-registration";
import moment from "moment";
import { AUTH_PREFIX_PATH, ENTRY_ROUTE } from "configs/AppConfig";
import {
  CUSTOMER_ROLE,
  USER_TYPE_ID_MAP,
} from "@sharecode/common/redux/constants/Auth";
import { showError } from "utils";
import "../register.scss";

const backgroundStyle = {
  backgroundColor: THEME_BLUE,
  backgroundSize: "cover",
};

const CustomerRegistration = () => {
  const [fileList, setFileList] = useState([]);
  const [params, setParams] = useState([]);
  const [expiryTime, setExpiryTime] = useState("");
  const [prefilledData, setPrefilledData] = useState({});
  const [disableRegistration, setDisableRegistration] = useState(false);
  const Intl = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const encodedLink = location?.search?.replace("?", "");

  useEffect(() => {
    const data = {
      link: encodedLink,
    };
    customerSignupService.decryptLink(data).then((res) => {
      setParams(res);
    });
  }, [encodedLink]);

  useEffect(() => {
    const searchParams = new URLSearchParams(params);
    let _prefilledData = {
      email: searchParams.get("email"),
      ntn: searchParams.get("ntn"),
      contactNumber: "+" + searchParams.get("contactNumber")?.trim(), // prepend + with contactNumber +, as by default URLSearchParams removes the + character
      customerType: searchParams.get("customerType"),
      companyId: searchParams.get("companyId"),
    };
    if (!searchParams.get("customerCompanyName")) {
      _prefilledData.firstName = searchParams.get("firstName");
      _prefilledData.middleName = searchParams.get("middleName");
      _prefilledData.surname = searchParams.get("surname");
    } else {
      _prefilledData.customerCompanyName = searchParams.get(
        "customerCompanyName"
      );
    }
    setPrefilledData(_prefilledData);
    setExpiryTime(searchParams.get("expiryTime"));
  }, [params]);

  useEffect(() => {
    if (expiryTime && moment().isAfter(expiryTime)) {
      PopupMessage({
        type: "error",
        message: Intl.formatMessage({
          id: "customer.registration.link.expired",
        }),
      });
      navigate(`${AUTH_PREFIX_PATH}/login`);
    }
  }, [expiryTime, navigate, Intl]);

  const signupMethod = async (generalData, setIsSuccess) => {
    try {
      setDisableRegistration(true);
      if (generalData?.userDto?.file !== undefined) {
        const formData = new FormData();
        formData.append("file", fileList[0]?.originFileObj);

        var imgData = await postMethod(
          customerSignupService,
          SIGN_UP_METHODS.uploadFile,
          formData
        );

        generalData.userDto.file = { id: imgData.id };
      } else {
        generalData.userDto.file = { id: null };
        imgData = 1;
      }
      if (imgData.id || generalData?.userDto.file.id === null) {
        return postMethod(
          customerSignupService,
          SIGN_UP_METHODS.customerSignup,
          generalData
        )
          .then((customerData) => {
            if (
              [400, 404, 204, false].includes(customerData?.response?.status)
            ) {
              setIsSuccess({ created: false, data: null });
              throw customerData?.response.data.details;
            } else {
              setDisableRegistration(false);
              setIsSuccess({ created: true, data: customerData });
              PopupMessage({
                type: "success",
                message: Intl.formatMessage({
                  id: "common.registration.email.dispatched",
                }),
              });
              navigate(ENTRY_ROUTE);
            }
            return customerData;
          })
          .catch((errors) => {
            setDisableRegistration(false);
            if (Array.isArray(errors)) {
              const updatedError = {
                response: {
                  data: {
                    details: errors,
                  },
                },
              };

              showError(updatedError);
            } else {
              showError(errors);
            }
          });
      } else {
        setDisableRegistration(false);
        showError(imgData.response.data);
      }
    } catch (errors) {
      setDisableRegistration(false);
      if (errors) {
        if (Array.isArray(errors)) {
          errors.forEach((error) => {
            showError(error);
          });
        } else {
          showError(errors);
        }
      }
    }
  };

  return (
    <div className="h-100 mt-5" style={backgroundStyle}>
      <div className="w-75 m-auto pt-5 pb-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={24} md={16}>
            <h1 className="yellow-color text-left">
              <div>
                <p
                  className="yellow-color"
                  data-testid="customer-registration-header"
                >
                  <IntlMessage id="customer.register" />
                </p>
              </div>
            </h1>
          </Col>
        </Row>
      </div>
      {prefilledData?.customerType && (
        <GeneralRegistration
          userRoleId={USER_TYPE_ID_MAP[CUSTOMER_ROLE]}
          prefilledData={prefilledData}
          role={CUSTOMER}
          signupMethod={signupMethod}
          setFileList={setFileList}
          fileList={fileList}
          disableRegistration={disableRegistration}
        />
      )}
    </div>
  );
};

export default CustomerRegistration;
