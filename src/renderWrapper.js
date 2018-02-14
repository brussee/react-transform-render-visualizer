import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import shouldPureComponentUpdate from 'react-pure-render/function';

const RenderVisualizer = {
  UPDATE_RENDER_LOG_POSITION_INTERVAL_MS: 500,
  MAX_LOG_LENGTH: 20,

  STATE_CHANGES: {
    MOUNT: 'mount',
    UPDATE: 'update'
  },

  styling: {
    renderLog: {
      color: 'rgb(85, 85, 85)',
      fontFamily: '\'Helvetica Neue\', Arial, Helvetica, sans-serif',
      fontSize: '14px',
      lineHeight: '18px',
      background: 'linear-gradient(#fff, #ccc)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      textShadow: '0 1px 0 #fff',
      borderRadius: '3px',
      position: 'absolute',
      top: 0,
      left: 0,
      maxWidth: '70%',
      padding: '5px 10px',
      zIndex: '10000',
      transition: '.3s all'
    },
    renderLogDetailNotes: {
      color: 'red',
      textAlign: 'center'
    },
    elementHighlightMonitor: {
      outline: '1px solid rgba(47, 150, 180, 1)'
    },
    elementHighlightMount: {
      outline: '3px solid rgba(197, 16, 12, 1)'
    },
    elementHighlightUpdate: {
      outline: '3px solid rgba(197, 203, 1, 1)'
    }
  }
};

let renders;
if (window.__reactRenders) {
  renders = window.__reactRenders;
} else {
  renders = new Map();
  Object.defineProperty(window, '__reactRenders', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: renders
  });
  window.__reactRendersCount = 0;
}

const containingElement = document.createElement('div');
document.body.appendChild(containingElement);

const addToRenderLog = function (inst, message) {
  // don't add anything to the log if the element doesn't exist any more
  if (!renders.get(inst)) {
    return;
  }
  let { log, count, ...others } = renders.get(inst);

  // add the log message to the start
  log = [`${ count } ) ${ message }`, ...log];

  // keep everything trimmed to the max log length
  log.splice(RenderVisualizer.MAX_LOG_LENGTH, 1);

  count++;

  renders.set(inst, {
    ...others,
    log,
    count
  });
};


/*
 * Get the changes made to props or state.
 *
 * @param object prevProps
 * @param object prevState
 * @param object nextProps
 * @param object nextState
 * @return boolean
 */
function getReasonForReRender (prevProps, prevState, nextProps, nextState) {
  for (let key in nextState) {
    if (nextState.hasOwnProperty(key) && nextState[key] !== prevState[key]) {
      if (typeof nextState[key] === 'object') {
        return `this.state[${ key }] changed`;
      } else {
        return `this.state[${ key }] changed: '${ prevState[key] }' => '${ nextState[key] }'`;
      }
    }
  }

  for (let key in nextProps) {
    if (nextProps.hasOwnProperty(key) && nextProps[key] !== prevProps[key]) {
      if (typeof nextProps[key] === 'object') {
        return `this.props[${ key }] changed`;
      } else {
        return `this.props[${ key }] changed: '${ prevProps[key] }' => '${ nextProps[key] }'`;
      }
    }
  }

  return 'unknown reason for update, possibly from forceUpdate()';
}


/*
 * Get Component displayName
 *
 * @param object Component
 * @return string
 */
function getDisplayName (Component) {
  return Component.displayName || Component.name || 'Component';
}

class RenderLog extends Component {
  static displayName = 'RenderLog';
  shouldComponentUpdate = shouldPureComponentUpdate;

  static defaultProps = {
    log: [],
    count: 1,
    node: null
  };
  static propTypes = {
    log: PropTypes.instanceOf(Array),
    count: PropTypes.number,
    node: PropTypes.object,
    posTop: PropTypes.number,
    posLeft: PropTypes.number
  };

  state = {
    showDetails: false
  };
  mousePosition;
  offset = {
    left: 0,
    top: 0
  };
  div;
  isDown = false;

  constructor (props) {
    super(props);

    this.setRef = this.setRef.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  componentWillMount () {
    this.highlightChange(RenderVisualizer.STATE_CHANGES.MOUNT);
  }

  componentDidUpdate (prevProps) {
    // only trigger a highlight if the change happened to the render count, as
    // this will also be triggered if the details are toggled
    if (prevProps.count !== this.props.count) {
      this.highlightChange(RenderVisualizer.STATE_CHANGES.UPDATE);
    }
  }

  /*
   * Highlight any change by adding an animation style to the component DOM node
   * @param String change - The type of change being made to the node
   * @return void
   */
  highlightChange (change) {
    const parentNode = ReactDOM.findDOMNode(this.props.node);
    const ANIMATION_DURATION = 500;

    if (parentNode) {
      parentNode.style.boxSizing = 'border-box';

      window.requestAnimationFrame(() => {
        parentNode.animate([
          change === RenderVisualizer.STATE_CHANGES.MOUNT ?
            RenderVisualizer.styling.elementHighlightMount :
            RenderVisualizer.styling.elementHighlightUpdate,
          RenderVisualizer.styling.elementHighlightMonitor
        ], {
          duration: ANIMATION_DURATION
        });
      });
    }
  }

  setRef (element) {
    this.div = element;
  }

  onClick (event) {
    this.setState(state => ({
      showDetails: !state.showDetails
    }));
  }

  onMouseDown (event) {
    this.isDown = true;
    this.offset = {
      left: this.div.offsetLeft - event.clientX,
      top: this.div.offsetTop - event.clientY
    };
  }

  onMouseUp (event) {
    this.isDown = false;
  }

  onMouseMove (event) {
    event.preventDefault();
    if (this.isDown) {
      this.mousePosition = {
        x: event.clientX,
        y: event.clientY
      };
      this.div.style.left = (this.mousePosition.x + this.offset.left) + 'px';
      this.div.style.top  = (this.mousePosition.y + this.offset.top) + 'px';
    }
  }

  render () {
    return (
      <div ref={this.setRef} style={{
        ...RenderVisualizer.styling.renderLog,

        // go to the top of everything if we're showing details
        zIndex: this.state.showDetails ? 10001 : 10000,

        // round coordinates down to prevent blurring
        transform: `translate3d(${this.props.posLeft | 0}px, ${this.props.posTop | 0}px, 0)`
      }} onClick={this.onClick} onMouseDown={this.onMouseDown} onMouseUp={this.onMouseUp} onMouseMove={this.onMouseMove}>
        <div style={{ display: this.state.showDetails ? 'none' : 'block' }}>{ this.props.count }</div>
        <div style={{ display: this.state.showDetails ? 'block' : 'none' }}>
          <div>
            {
              this.props.log.map((message, i) => {
                return <div key={i}>{message}</div>;
              })
            }
          </div>
          <div style={RenderVisualizer.styling.renderLogDetailNode} />
        </div>
      </div>
    );
  }
}


class RenderLogs extends Component {
  static displayName = 'RenderLogs';

  static propTypes = {
    renders: PropTypes.object
  };

  render () {
    const renderLogs = [];
    this.props.renders.forEach((val, key) => {
      renderLogs.push(<RenderLog key={val.id} {...val} node={key} />);
    });
    return <div>{ renderLogs }</div>;
  }
}


window.setInterval(() => {
  renders.forEach((val, node) => {
    const parentNode = ReactDOM.findDOMNode(node);
    const parentNodeRect = parentNode && parentNode.getBoundingClientRect();

    if (parentNodeRect) {
      renders.set(node, {
        ...val,
        posTop: window.pageYOffset + parentNodeRect.top,
        posLeft: parentNodeRect.left
      });
    }
  });
  ReactDOM.render(React.createElement(RenderLogs, { renders: renders }), containingElement);
}, RenderVisualizer.UPDATE_RENDER_LOG_POSITION_INTERVAL_MS);

ReactDOM.render(React.createElement(RenderLogs, { renders: renders }), containingElement);

export default function createRenderVisualizer (shouldInstrumentComponent = () => true) {
  return function renderVisualizer () {
    return function wrapRenderVisualizer (ReactClass, componentId) {

      if (!shouldInstrumentComponent(ReactClass)) {
        return ReactClass;
      }

      const old = {
        componentDidMount: ReactClass.prototype.componentDidMount,
        componentDidUpdate: ReactClass.prototype.componentDidUpdate,
        componentWillUnmount: ReactClass.prototype.componentWillUnmount
      };

      ReactClass.prototype.componentDidMount = function () {
        renders.set(this, {
          id: window.__reactRendersCount++,
          log: [],
          count: 0,

          posTop: 0,
          posLeft: 0
        });
        const componentName = getDisplayName(ReactClass);
        addToRenderLog(this, componentName + ' Initial Render');

        if (old.componentDidMount) {
          return old.componentDidMount.apply(this, [...arguments]);
        }
      };
      ReactClass.prototype.componentDidUpdate = function (prevProps, prevState) {
        addToRenderLog(this, getReasonForReRender(prevProps, prevState, this.props, this.state));

        if (old.componentDidUpdate) {
          return old.componentDidUpdate.apply(this, [...arguments]);
        }
      };
      ReactClass.prototype.componentWillUnmount = function () {
        renders.delete(this);

        if (old.componentWillUnmount) {
          return old.componentWillUnmount.apply(this, [...arguments]);
        }
      };

      return ReactClass;
    };
  };
}
