import * as React from 'react'
import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useContext } from 'react'
import cxs from 'cxs'
import { useUID } from 'react-uid'
import { Modal } from 'antd'
import { useWindowSize } from './useWindowSize'
import { ResizeHandle } from './ResizeHandle'
import { useImagineDraggin } from './useImagineDraggin'
import { clamp } from './clamp'
import { DraggableModalContext } from './DraggableModalContext'
import { usePrevious } from './usePrevious'

// Wish there was a better way.
const className = cxs({
    pointerEvents: 'none',
    overflow: 'hidden !important',
    ' > .ant-modal': {
        display: 'flex',
        maxWidth: 'none',
    },
    ' > .ant-modal > .ant-modal-content': {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },
    ' > .ant-modal > .ant-modal-content > .ant-modal-body': {
        flex: 1,
        overflowY: 'auto',
    },
    ' > .ant-modal > .ant-modal-content > .ant-modal-footer': {
        padding: '16px',
    },
})

const modalStyle = { margin: 0, paddingBottom: 0, pointerEvents: 'auto' }
const headerStyle = { cursor: 'move' }

export type DraggableModalProps = any

export const DraggableModal = (props: DraggableModalProps) => {
    const [dragging, setDragging] = useState(false)
    const [resizing, setResizing] = useState(false)
    const [left, setLeft] = useState(0)
    const [top, setTop] = useState(0)
    const [width, setWidth] = useState(500)
    const [height, setHeight] = useState(300)

    // Manage zIndex.
    const id = useUID()
    const modalProvider = useContext(DraggableModalContext)
    const zIndex = modalProvider.state[id]
    const bringToFront = useCallback(() => modalProvider.bringToFront(id), [modalProvider, id])
    // Register and unregister.
    useEffect(() => {
        modalProvider.registerModal(id)
        return () => modalProvider.unregisterModal(id)
    }, [modalProvider, id])

    // Bring this to the front if it's been opened with props.
    const { visible } = props
    const visiblePrevious = usePrevious(visible)
    useEffect(() => {
        if (visible && !visiblePrevious) {
            bringToFront()
        }
    }, [visible, visiblePrevious])

    const onMouseDownDrag = useImagineDraggin(left, setLeft, top, setTop, dragging, setDragging)
    const onMouseDownResize = useImagineDraggin(
        width,
        setWidth,
        height,
        setHeight,
        resizing,
        setResizing,
    )

    const onMouseDownDragWrapped = useCallback(
        e => {
            bringToFront()
            onMouseDownDrag(e)
        },
        // You'd think onMouseDownDrag would be referentially not equal if
        // e.g. left changed, but it does not work without all the dependencies here.
        [bringToFront, onMouseDownDrag, left, setLeft, top, setTop, dragging, setDragging],
    )

    const onMouseDownResizeWrapped = useCallback(
        e => {
            bringToFront()
            onMouseDownResize(e)
        },
        [bringToFront, onMouseDownDrag, width, setWidth, height, setHeight, resizing, setResizing],
    )

    // All the logic to keep the modal within bounds.
    const { width: windowWidth, height: windowHeight } = useWindowSize()
    useLayoutEffect(() => {
        if (windowWidth === undefined) return
        if (windowHeight === undefined) return

        const clampDrag = () => {
            const maxLeft = windowWidth - width
            const maxTop = windowHeight - height
            const x = clamp(0, maxLeft, left)
            const y = clamp(0, maxTop, top)
            setLeft(x)
            setTop(y)
            return { x, y }
        }

        const clampResize = ({ x = left, y = top } = {}) => {
            const maxWidth = windowWidth - x
            const maxHeight = windowHeight - y
            setWidth(clamp(200, maxWidth, width))
            setHeight(clamp(200, maxHeight, height))
        }

        if (dragging) {
            clampDrag()
        } else if (resizing) {
            clampResize()
        } else {
            // We try to push it over.
            const newCoordinates = clampDrag()
            // If that's not enough then resize too.
            // It needs to be done with the new coordinates from the drag clamping.
            clampResize(newCoordinates)
        }
    }, [windowWidth, windowHeight, top, left, width, height, dragging, resizing])

    const style = useMemo(() => ({ ...modalStyle, top, left, height }), [
        modalStyle,
        top,
        left,
        height,
    ])
    return (
        <Modal
            wrapClassName={className}
            style={style}
            destroyOnClose={true}
            width={width}
            mask={false}
            maskClosable={false}
            zIndex={zIndex}
            title={
                <div style={headerStyle} onMouseDown={onMouseDownDragWrapped}>
                    Title
                </div>
            }
            {...props}
        >
            {props.children}
            <ResizeHandle onMouseDown={onMouseDownResizeWrapped} />
        </Modal>
    )
}
