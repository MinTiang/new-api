package common

import (
	"net"
	"strings"

	"github.com/gin-gonic/gin"
)

// GetClientIP prefers Cloudflare's validated client address header and falls
// back to Gin's proxy-aware resolution when the header is absent or invalid.
func GetClientIP(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}

	cloudflareIP := strings.TrimSpace(c.GetHeader("CF-Connecting-IP"))
	if parsed := net.ParseIP(cloudflareIP); parsed != nil {
		return parsed.String()
	}

	return c.ClientIP()
}
