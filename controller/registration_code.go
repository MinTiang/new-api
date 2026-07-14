package controller

import (
	"errors"
	"net/http"
	"strconv"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllRegistrationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.GetAllRegistrationCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchRegistrationCodes(c *gin.Context) {
	keyword := c.Query("keyword")
	status := c.Query("status")
	pageInfo := common.GetPageQuery(c)
	codes, total, err := model.SearchRegistrationCodes(keyword, status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetRegistrationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	code, err := model.GetRegistrationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

func AddRegistrationCode(c *gin.Context) {
	code := model.RegistrationCode{}
	if err := c.ShouldBindJSON(&code); err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(code.Name) == 0 || utf8.RuneCountInString(code.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeNameLength)
		return
	}
	if code.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeCountPositive)
		return
	}
	if code.Count > 100 {
		common.ApiErrorI18n(c, i18n.MsgRegistrationCodeCountMax)
		return
	}
	if valid, msg := validateExpiredTime(c, code.ExpiredTime); !valid {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}
	keys, err := model.CreateRegistrationCodes(code.Name, code.Count, code.ExpiredTime)
	if err != nil {
		common.SysError("failed to create registration codes: " + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgRegistrationCodeCreateFailed),
			"data":    keys,
		})
		return
	}
	recordManageAudit(c, "registration_code.create", map[string]interface{}{
		"name":  code.Name,
		"count": code.Count,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
}

func UpdateRegistrationCode(c *gin.Context) {
	statusOnly := c.Query("status_only")
	code := model.RegistrationCode{}
	if err := c.ShouldBindJSON(&code); err != nil {
		common.ApiError(c, err)
		return
	}
	cleanCode, err := model.GetRegistrationCodeById(code.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly == "" {
		if utf8.RuneCountInString(code.Name) == 0 || utf8.RuneCountInString(code.Name) > 20 {
			common.ApiErrorI18n(c, i18n.MsgRegistrationCodeNameLength)
			return
		}
		if valid, msg := validateExpiredTime(c, code.ExpiredTime); !valid {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
			return
		}
		cleanCode.Name = code.Name
		cleanCode.ExpiredTime = code.ExpiredTime
	} else {
		cleanCode.Status = code.Status
	}
	if err := cleanCode.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, cleanCode)
}

func DeleteRegistrationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	if err := model.DeleteRegistrationCodeById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func DeleteInvalidRegistrationCode(c *gin.Context) {
	rows, err := model.DeleteInvalidRegistrationCodes()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

func registrationCodeMessageKey(err error) string {
	switch {
	case errors.Is(err, model.ErrRegistrationCodeNotProvided):
		return i18n.MsgRegistrationCodeNotProvided
	case errors.Is(err, model.ErrRegistrationCodeExpired):
		return i18n.MsgRegistrationCodeExpired
	case errors.Is(err, model.ErrRegistrationCodeUsed):
		return i18n.MsgRegistrationCodeUsed
	case errors.Is(err, model.ErrRegistrationCodeDisabled):
		return i18n.MsgRegistrationCodeDisabled
	case errors.Is(err, model.ErrRegistrationCodeInvalid):
		return i18n.MsgRegistrationCodeInvalid
	default:
		return ""
	}
}
