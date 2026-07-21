package common

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetClientIPPrefersCloudflareHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		remoteAddr string
		cfHeader   string
		want       string
	}{
		{
			name:       "cloudflare ipv4",
			remoteAddr: "10.0.0.2:1234",
			cfHeader:   "203.0.113.8",
			want:       "203.0.113.8",
		},
		{
			name:       "cloudflare ipv6",
			remoteAddr: "10.0.0.2:1234",
			cfHeader:   "2001:db8::8",
			want:       "2001:db8::8",
		},
		{
			name:       "invalid cloudflare header falls back",
			remoteAddr: "198.51.100.7:4321",
			cfHeader:   "not-an-ip",
			want:       "198.51.100.7",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			req.RemoteAddr = tt.remoteAddr
			req.Header.Set("CF-Connecting-IP", tt.cfHeader)
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = req

			assert.Equal(t, tt.want, GetClientIP(ctx))
		})
	}
}
