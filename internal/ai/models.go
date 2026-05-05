package ai

import "github.com/pkg/errors"

const (
	// DefaultOpenAITranscriptionModel is the built-in OpenAI transcription model.
	DefaultOpenAITranscriptionModel = "gpt-4o-transcribe"
	// DefaultGeminiTranscriptionModel is the built-in Gemini transcription model.
	DefaultGeminiTranscriptionModel = "gemini-2.5-flash"
)

// DefaultTranscriptionModel returns the built-in transcription model for a provider type.
func DefaultTranscriptionModel(providerType ProviderType) (string, error) {
	switch providerType {
	case ProviderOpenAI:
		return DefaultOpenAITranscriptionModel, nil
	case ProviderGemini:
		return DefaultGeminiTranscriptionModel, nil
	default:
		return "", errors.Wrapf(ErrCapabilityUnsupported, "provider type %q", providerType)
	}
}

// TranscriptionModel returns the configured transcription model or the provider default.
func TranscriptionModel(provider ProviderConfig) (string, error) {
	if provider.TranscriptionModel != "" {
		return provider.TranscriptionModel, nil
	}
	return DefaultTranscriptionModel(provider.Type)
}
