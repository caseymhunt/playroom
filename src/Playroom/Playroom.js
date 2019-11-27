import React, { useState, useEffect } from 'react';
import parsePropTypes from 'parse-prop-types';
import flatMap from 'lodash/flatMap';
import debounce from 'lodash/debounce';
import omit from 'lodash/omit';
import Resizable from 're-resizable';
import Preview from './Preview/Preview';
import styles from './Playroom.less';
import { store } from '../index';
import WindowPortal from './WindowPortal';
import { CodeEditor } from './CodeEditor/CodeEditor';

const themesImport = require('./themes');
const componentsImport = require('./components');
const patternsImport = require('./patterns');

const resizableConfig = {
  top: true,
  right: false,
  bottom: false,
  left: false,
  topRight: false,
  bottomRight: false,
  bottomLeft: false,
  topLeft: false
};

export default ({ getCode, updateCode: persistCode, staticTypes, widths }) => {
  const [themes, setThemes] = useState(themesImport);
  const [components, setComponents] = useState(componentsImport);
  const [patterns, setPatterns] = useState(patternsImport);

  const [code, setCode] = useState('');
  const [previewCode, setPreviewCode] = useState(null);
  const [codeReady, setCodeReady] = useState(false);
  const [editorHeight, setEditorHeight] = useState(200);
  const [editorUndocked, setEditorUndocked] = useState(false);

  useEffect(() => {
    if (module.hot) {
      module.hot.accept('./themes', () => {
        setThemes(require('./themes'));
      });

      module.hot.accept('./components', () => {
        setComponents(require('./components'));
      });

      module.hot.accept('./patterns', () => {
        setPatterns(require('./patterns'));
      });
    }

    Promise.all([getCode(), store.getItem('editorSize')]).then(
      ([resolvedCode, height]) => {
        setEditorHeight(height);
        setCode(resolvedCode);
        setCodeReady(true);
      }
    );
  }, [getCode]);

  useEffect(() => {
    debounce(persistCode, 500)(code);
  }, [code, persistCode]);

  const themeNames = Object.keys(themes);
  const frames = flatMap(widths, width =>
    themeNames.map(theme => {
      return { theme, width };
    })
  );

  const componentNames = Object.keys(components).sort();
  const tags = Object.assign(
    {},
    ...componentNames.map(componentName => {
      const staticTypesForComponent = staticTypes[componentName];
      if (
        staticTypesForComponent &&
        Object.keys(staticTypesForComponent).length > 0
      ) {
        return {
          [componentName]: {
            attrs: staticTypesForComponent
          }
        };
      }

      const parsedPropTypes = parsePropTypes(components[componentName]);
      const filteredPropTypes = omit(parsedPropTypes, 'children', 'className');
      const propNames = Object.keys(filteredPropTypes);

      return {
        [componentName]: {
          attrs: Object.assign(
            {},
            ...propNames.map(propName => {
              const propType = filteredPropTypes[propName].type;

              return {
                [propName]:
                  propType.name === 'oneOf'
                    ? propType.value.filter(x => typeof x === 'string')
                    : null
              };
            })
          )
        }
      };
    })
  );

  if (!codeReady) {
    return null;
  }

  const codeEditor = (
    <CodeEditor
      code={code}
      onChange={setCode}
      hints={tags}
      patterns={
        typeof patterns.default !== 'undefined' ? patterns.default : patterns
      }
      onUndock={() => setEditorUndocked(docked => !docked)}
      onPreviewCode={newPreviewCode => {
        setPreviewCode(newPreviewCode);
      }}
    />
  );
  const editorContainer = editorUndocked ? (
    <WindowPortal
      height={window.outerHeight}
      width={window.outerWidth}
      onClose={() => setEditorUndocked(false)}
    >
      {codeEditor}
    </WindowPortal>
  ) : (
    <Resizable
      className={styles.editorContainer}
      defaultSize={{
        height: `${editorHeight}`, // issue in ff & safari when not a string
        width: '100vw'
      }}
      onResize={(event, direction, ref) => {
        debounce(height => {
          setEditorHeight(height);
          store.setItem('editorSize', height);
        }, 1)(ref.offsetHeight);
      }}
      enable={resizableConfig}
    >
      {codeEditor}
    </Resizable>
  );

  return (
    <div className={styles.root}>
      <div
        className={styles.previewContainer}
        style={{ bottom: !editorUndocked ? editorHeight : undefined }}
      >
        <Preview code={previewCode || code} themes={themes} frames={frames} />
      </div>
      {editorContainer}
    </div>
  );
};
