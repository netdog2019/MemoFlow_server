package ai

// ProviderType identifies an AI provider implementation.
type ProviderType string

const (
	// ProviderOpenAI is OpenAI's hosted API.
	ProviderOpenAI ProviderType = "OPENAI"
	// ProviderGemini is Google's Gemini API.
	ProviderGemini ProviderType = "GEMINI"
)

// ProviderConfig configures a callable AI provider connection.
type ProviderConfig struct {
	ID                 string
	Title              string
	Type               ProviderType
	Endpoint           string
	APIKey             string
	Model              string
	TranscriptionModel string
	SystemPrompt       string
	Prompt             string
	Temperature        float32
	TopP               float32
	MaxTokens          int32
	TimeoutSeconds     int32
	ExtraOptionsJSON   string
}
