import {
  replaceInterpolations,
  reInsertInterpolations,
  Matcher,
} from '../matchers';
import { TranslationService, TString } from '.';
import { TranslationServiceClient } from '@google-cloud/translate';
import { google } from '@google-cloud/translate/build/protos/protos';
import ITranslateTextGlossaryConfig = google.cloud.translation.v3beta1.ITranslateTextGlossaryConfig;

// Contains replacements for language codes
const codeMap = {
  'zh-tw': 'zh-TW',
};

export class GoogleTranslate implements TranslationService {
  private interpolationMatcher: Matcher;
  private keyFileName: string | null;

  public name = 'Google Translate';

  cleanResponse(response: string) {
    return response.replace(
      /\<(.+?)\s*\>\s*(.+?)\s*\<\/\s*(.+?)>/g,
      '<$1>$2</$3>',
    );
  }

  async initialize(config?: string, interpolationMatcher?: Matcher) {
    this.keyFileName = config;

    this.interpolationMatcher = interpolationMatcher;
  }

  supportsLanguage(language: string) {
    return true; // gcloud should support all relevant languages.
  }

  cleanLanguageCode(languageCode: string) {
    const lowerCaseCode = languageCode.toLowerCase();

    if (codeMap[lowerCaseCode]) {
      return codeMap[lowerCaseCode];
    }

    return lowerCaseCode.split('-')[0];
  }

  async translateStrings(strings: TString[], from: string, to: string) {
    const translationClient = new TranslationServiceClient({
      keyFilename: this.keyFileName,
    });

    const location = "us-central1";
    const glossaryId = "en_de_glossary"; // TODO: Pass externally. Make optional.
    const projectId: string = await translationClient.getProjectId();
    const glossaryConfig: ITranslateTextGlossaryConfig = {
      glossary: `projects/${projectId}/locations/${location}/glossaries/${glossaryId}`,
      ignoreCase: true,
    };

    const translateSingleString = async (clean: string): Promise<string> => {
      if (clean.length === 0) {
        return "";
      }
      const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [clean],
        mimeType: 'text/plain',
        sourceLanguageCode: this.cleanLanguageCode(from),
        targetLanguageCode: this.cleanLanguageCode(to),
        glossaryConfig: glossaryConfig,
      };
      const [ response ] = await translationClient.translateText(request);
      const results = response.glossaryTranslations || response.translations;
      return results[0].translatedText;
    }

    return Promise.all(
      strings.map(async ({ key, value }) => {

        let { clean, replacements } = replaceInterpolations(
          value,
          this.interpolationMatcher,
        );

        const translationResult = await translateSingleString(clean);

        return {
          key: key,
          value: value,
          translated: this.cleanResponse(
            reInsertInterpolations(translationResult, replacements),
          ),
        };
      }),
    );
  }
}
