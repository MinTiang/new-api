package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const RegistrationCodeLength = 24

var (
	ErrRegistrationCodeNotProvided = errors.New("registration code not provided")
	ErrRegistrationCodeInvalid     = errors.New("invalid registration code")
	ErrRegistrationCodeUsed        = errors.New("registration code has been used")
	ErrRegistrationCodeDisabled    = errors.New("registration code has been disabled")
	ErrRegistrationCodeExpired     = errors.New("registration code has expired")
)

type RegistrationCode struct {
	Id            int            `json:"id"`
	Name          string         `json:"name" gorm:"index"`
	Key           string         `json:"key" gorm:"type:char(24);uniqueIndex"`
	Status        int            `json:"status" gorm:"default:1"`
	CreatedTime   int64          `json:"created_time" gorm:"bigint"`
	UsedTime      int64          `json:"used_time" gorm:"bigint"`
	ExpiredTime   int64          `json:"expired_time" gorm:"bigint"`
	UsedUserId    int            `json:"used_user_id" gorm:"index"`
	Count         int            `json:"count" gorm:"-:all"`
	UsedUsername  string         `json:"used_username" gorm:"-:all"`
	DeletedAt     gorm.DeletedAt `gorm:"index"`
}

func GetAllRegistrationCodes(startIdx int, num int) (codes []*RegistrationCode, total int64, err error) {
	err = DB.Model(&RegistrationCode{}).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = DB.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		return nil, 0, err
	}
	fillRegistrationCodeUsers(codes)
	return codes, total, nil
}

func SearchRegistrationCodes(keyword string, status string, startIdx int, num int) (codes []*RegistrationCode, total int64, err error) {
	query := DB.Model(&RegistrationCode{})
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		if id, err := strconv.Atoi(keyword); err == nil {
			query = query.Where(
				"id = ? OR name LIKE ? OR "+registrationCodeKeyCol()+" LIKE ?",
				id,
				keyword+"%",
				keyword+"%",
			)
		} else {
			query = query.Where(
				"name LIKE ? OR "+registrationCodeKeyCol()+" LIKE ?",
				keyword+"%",
				keyword+"%",
			)
		}
	}
	if status != "" {
		now := common.GetTimestamp()
		switch status {
		case "expired":
			query = query.Where(
				"status = ? AND expired_time != 0 AND expired_time < ?",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusEnabled):
			query = query.Where(
				"status = ? AND (expired_time = 0 OR expired_time >= ?)",
				common.RedemptionCodeStatusEnabled,
				now,
			)
		case strconv.Itoa(common.RedemptionCodeStatusDisabled):
			query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
		case strconv.Itoa(common.RedemptionCodeStatusUsed):
			query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
		}
	}
	err = query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&codes).Error
	if err != nil {
		return nil, 0, err
	}
	fillRegistrationCodeUsers(codes)
	return codes, total, nil
}

func fillRegistrationCodeUsers(codes []*RegistrationCode) {
	userIds := make([]int, 0)
	seen := map[int]bool{}
	for _, code := range codes {
		if code.UsedUserId > 0 && !seen[code.UsedUserId] {
			userIds = append(userIds, code.UsedUserId)
			seen[code.UsedUserId] = true
		}
	}
	if len(userIds) == 0 {
		return
	}
	var users []User
	if err := DB.Select("id", "username").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		common.SysLog("failed to load registration code users: " + err.Error())
		return
	}
	usernames := map[int]string{}
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	for _, code := range codes {
		code.UsedUsername = usernames[code.UsedUserId]
	}
}

func GetRegistrationCodeById(id int) (*RegistrationCode, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	code := RegistrationCode{Id: id}
	if err := DB.First(&code, "id = ?", id).Error; err != nil {
		return nil, err
	}
	fillRegistrationCodeUsers([]*RegistrationCode{&code})
	return &code, nil
}

func CreateRegistrationCodes(name string, count int, expiredTime int64) ([]string, error) {
	keys := make([]string, 0, count)
	err := DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < count; i++ {
			key, err := newRegistrationCodeKey(tx)
			if err != nil {
				return err
			}
			code := RegistrationCode{
				Name:        name,
				Key:         key,
				Status:      common.RedemptionCodeStatusEnabled,
				CreatedTime: common.GetTimestamp(),
				ExpiredTime: expiredTime,
			}
			if err := tx.Create(&code).Error; err != nil {
				return err
			}
			keys = append(keys, key)
		}
		return nil
	})
	return keys, err
}

func newRegistrationCodeKey(tx *gorm.DB) (string, error) {
	for i := 0; i < 8; i++ {
		key, err := common.GenerateRandomCharsKey(RegistrationCodeLength)
		if err != nil {
			return "", err
		}
		var count int64
		if err := tx.Model(&RegistrationCode{}).
			Where(registrationCodeKeyCol()+" = ?", key).
			Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return key, nil
		}
	}
	return "", errors.New("failed to generate unique registration code")
}

func (code *RegistrationCode) Update() error {
	return DB.Model(code).Select("name", "status", "expired_time").Updates(code).Error
}

func DeleteRegistrationCodeById(id int) error {
	if id == 0 {
		return errors.New("id 为空！")
	}
	return DB.Delete(&RegistrationCode{}, id).Error
}

func DeleteInvalidRegistrationCodes() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where(
		"status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)",
		[]int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled},
		common.RedemptionCodeStatusEnabled,
		now,
	).Delete(&RegistrationCode{})
	return result.RowsAffected, result.Error
}

func UseRegistrationCodeWithTx(tx *gorm.DB, key string, userId int) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return ErrRegistrationCodeNotProvided
	}
	if userId == 0 {
		return errors.New("invalid user id")
	}
	code := &RegistrationCode{}
	err := lockForUpdate(tx).Where(registrationCodeKeyCol()+" = ?", key).First(code).Error
	if err != nil {
		return ErrRegistrationCodeInvalid
	}
	switch code.Status {
	case common.RedemptionCodeStatusEnabled:
	case common.RedemptionCodeStatusUsed:
		return ErrRegistrationCodeUsed
	case common.RedemptionCodeStatusDisabled:
		return ErrRegistrationCodeDisabled
	default:
		return ErrRegistrationCodeInvalid
	}
	if code.ExpiredTime != 0 && code.ExpiredTime < common.GetTimestamp() {
		return ErrRegistrationCodeExpired
	}
	result := tx.Model(&RegistrationCode{}).
		Where("id = ? AND status = ?", code.Id, common.RedemptionCodeStatusEnabled).
		Updates(map[string]interface{}{
			"status":       common.RedemptionCodeStatusUsed,
			"used_time":    common.GetTimestamp(),
			"used_user_id": userId,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrRegistrationCodeUsed
	}
	return nil
}

func registrationCodeKeyCol() string {
	if commonKeyCol != "" {
		return commonKeyCol
	}
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		return `"key"`
	}
	return "`key`"
}
