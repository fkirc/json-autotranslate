//import { Translate } from '@google-cloud/translate';
import {
  replaceInterpolations,
  reInsertInterpolations,
  Matcher,
} from '../matchers';
import { TranslationService, TString } from '.';
import { TranslationServiceClient } from '@google-cloud/translate';

// Contains replacements for language codes
const codeMap = {
  'zh-tw': 'zh-TW',
};

export class GoogleTranslate implements TranslationService {
  //private translate: Translate;
  private interpolationMatcher: Matcher;
  private keyFileName: string | null;
  //private supportedLanguages: string[] = [];

  public name = 'Google Translate';

  cleanResponse(response: string) {
    return response.replace(
      /\<(.+?)\s*\>\s*(.+?)\s*\<\/\s*(.+?)>/g,
      '<$1>$2</$3>',
    );
  }

  async initialize(config?: string, interpolationMatcher?: Matcher) {
    // this.translate = new Translate({
    //   autoRetry: true,
    //   keyFilename: config || undefined,
    // });
    this.keyFileName = config;

    this.interpolationMatcher = interpolationMatcher;
    //this.supportedLanguages = await this.getAvailableLanguages();
  }

  async getAvailableLanguages() {
    // const [languages] = await this.translate.getLanguages();
    // console.log(languages);
    // return languages.map((l) => l.code.toLowerCase());
  }

  supportsLanguage(language: string) {
    return true;
    //return this.supportedLanguages.includes(language);
  }

  cleanLanguageCode(languageCode: string) {
    const lowerCaseCode = languageCode.toLowerCase();
    console.log('Lower case:', languageCode);

    if (codeMap[lowerCaseCode]) {
      return codeMap[lowerCaseCode];
    }

    return lowerCaseCode.split('-')[0];
  }

  async translateStrings(strings: TString[], from: string, to: string) {
    const translationClient = new TranslationServiceClient({
      keyFilename: this.keyFileName,
    });

    return Promise.all(
      strings.map(async ({ key, value }) => {
        const { clean, replacements } = replaceInterpolations(
          value,
          this.interpolationMatcher,
        );

        const glossaryConfig = {
          glossary: `projects/project-id/locations/location/glossaries/glossary`,
        };
        const request = {
          parent: `projects/project-id/locations/location`,
          contents: [clean],
          mimeType: 'text/plain',
          sourceLanguageCode: this.cleanLanguageCode(from),
          targetLanguageCode: this.cleanLanguageCode(to),
          glossaryConfig: glossaryConfig,
        };
        const [ response ] = await translationClient.translateText(request);
        const translationResult = JSON.stringify(response.glossaryTranslations);

        // const [translationResult] = await this.translate.translate(clean, {
        //   from: this.cleanLanguageCode(from),
        //   to: this.cleanLanguageCode(to),
        // });

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
