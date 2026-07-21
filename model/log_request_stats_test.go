package model

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecordConsumeLogAlwaysRecordsClientMetadata(t *testing.T) {
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Log{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Log{}).Error)
	})

	req := httptest.NewRequest("POST", "/v1/chat/completions", nil)
	req.RemoteAddr = "10.0.0.2:1234"
	req.Header.Set("CF-Connecting-IP", "203.0.113.10")
	req.Header.Set("User-Agent", "request-client/1.0")
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = req
	ctx.Set("username", "client-user")

	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ModelName: "gpt-test",
		Other: map[string]interface{}{
			"request_path": "/v1/chat/completions",
		},
	})

	var log Log
	require.NoError(t, DB.Order("id desc").First(&log).Error)
	assert.Equal(t, "203.0.113.10", log.Ip)
	other, err := common.StrToMap(log.Other)
	require.NoError(t, err)
	assert.Equal(t, "request-client/1.0", other["user_agent"])
}

func TestGetRequestEndpointStats(t *testing.T) {
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Log{}).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Log{}).Error)
	})

	logs := []Log{
		{
			UserId: 1, CreatedAt: 100, Type: LogTypeConsume,
			PromptTokens: 10, CompletionTokens: 5, Quota: 100, UseTime: 2,
			Other: common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/messages"}),
		},
		{
			UserId: 1, CreatedAt: 110, Type: LogTypeError, UseTime: 4,
			Other: common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/message"}),
		},
		{
			UserId: 1, CreatedAt: 120, Type: LogTypeConsume,
			PromptTokens: 20, CompletionTokens: 10, Quota: 200, UseTime: 6,
			Other: common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/responses"}),
		},
		{
			UserId: 2, CreatedAt: 129, Type: LogTypeError, UseTime: 20,
			RequestId: "retried-request",
			Other:     common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
		},
		{
			UserId: 1, CreatedAt: 129, Type: LogTypeError, UseTime: 3,
			RequestId: "retried-request",
			Other:     common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
		},
		{
			UserId: 2, CreatedAt: 130, Type: LogTypeConsume, RequestId: "retried-request",
			PromptTokens: 30, CompletionTokens: 15, Quota: 300, UseTime: 8,
			Other: common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
		},
		{
			UserId: 1, CreatedAt: 140, Type: LogTypeConsume,
			Other: common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/embeddings"}),
		},
	}
	require.NoError(t, DB.Create(&logs).Error)

	stats, err := GetRequestEndpointStats(0, 100, 130)
	require.NoError(t, err)
	require.Len(t, stats.Items, 3)
	assert.Equal(t, int64(5), stats.Requests)
	assert.Equal(t, int64(3), stats.Success)
	assert.Equal(t, int64(2), stats.Failed)
	assert.Equal(t, int64(90), stats.TotalTokens)
	assert.Equal(t, int64(600), stats.Quota)
	assert.InDelta(t, 4.6, stats.AverageResponseTime, 0.001)

	messages := stats.Items[0]
	assert.Equal(t, "/v1/messages", messages.Path)
	assert.Equal(t, int64(2), messages.Requests)
	assert.Equal(t, int64(1), messages.Success)
	assert.Equal(t, int64(1), messages.Failed)
	assert.Equal(t, int64(15), messages.TotalTokens)
	assert.InDelta(t, 3, messages.AverageResponseTime, 0.001)

	userStats, err := GetRequestEndpointStats(1, 100, 130)
	require.NoError(t, err)
	assert.Equal(t, int64(4), userStats.Requests)
	assert.Equal(t, int64(45), userStats.TotalTokens)
	assert.Equal(t, int64(300), userStats.Quota)
	assert.Equal(t, int64(1), userStats.Items[2].Requests)
}
