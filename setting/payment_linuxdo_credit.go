package setting

const LinuxDOCreditDefaultPayAddress = "https://credit.linux.do/epay/pay"

var (
	LinuxDOCreditEnabled      bool
	LinuxDOCreditPayAddress   string = LinuxDOCreditDefaultPayAddress
	LinuxDOCreditClientId     string
	LinuxDOCreditClientSecret string
	LinuxDOCreditMinTopUp     int = 1
)
